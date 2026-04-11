import type { GemmaClient } from "@/lib/ai/client";
import type { Prompt, TestCase, PromptMetadata } from "./types";
import { buildBatchedJudgePrompt, buildJudgePrompt } from "@/lib/ai/prompts";
import * as queries from "@/lib/db/queries";

interface EvaluationResult {
  prompt: Prompt;
  fitness: number;
  metadata: PromptMetadata;
}

/**
 * Evaluate a single prompt against all test cases.
 * Uses batched judging to minimize API calls.
 */
export async function evaluatePrompt(
  ai: GemmaClient,
  prompt: Prompt,
  testCases: TestCase[],
  taskDescription: string,
  batchJudging: boolean,
): Promise<EvaluationResult> {
  // Step 1: Execute prompt against each test case
  const responses: Array<{ testCase: TestCase; response: string; latencyMs: number; tokensUsed: number }> = [];

  for (const tc of testCases) {
    const promptWithInput = prompt.text.replace("{input}", tc.input);
    const startTime = Date.now();

    const result = await ai.generate({
      prompt: promptWithInput,
      temperature: 0.0,
      maxTokens: 512,
    });

    responses.push({
      testCase: tc,
      response: result.text,
      latencyMs: result.latencyMs,
      tokensUsed: result.tokensUsed,
    });
  }

  // Step 2: Judge responses
  const scores: Record<string, number> = {};
  const reasonings: Record<string, string> = {};

  if (batchJudging && testCases.length > 1) {
    // Batched: one LLM call for all test cases
    const judgeResult = await ai.generate({
      prompt: buildBatchedJudgePrompt(
        taskDescription,
        prompt.text,
        responses.map((r) => ({
          id: r.testCase.id,
          input: r.testCase.input,
          expectedOutput: r.testCase.expectedOutput,
          actualResponse: r.response,
        })),
      ),
      temperature: 0.0,
      jsonMode: true,
      maxTokens: 2048,
    });

    const judgeData = parseBatchedJudgeResponse(judgeResult.text, testCases);

    for (const tc of testCases) {
      const evaluation = judgeData[tc.id] ?? { score: 0, reasoning: "Failed to parse judge response" };
      scores[tc.id] = Math.max(0, Math.min(1, evaluation.score));
      reasonings[tc.id] = evaluation.reasoning;
    }
  } else {
    // Individual: one LLM call per test case
    for (const r of responses) {
      const judgeResult = await ai.generate({
        prompt: buildJudgePrompt(
          taskDescription,
          prompt.text,
          r.testCase.input,
          r.testCase.expectedOutput,
          r.response,
        ),
        temperature: 0.0,
        jsonMode: true,
        maxTokens: 256,
      });

      const parsed = parseIndividualJudgeResponse(judgeResult.text);
      scores[r.testCase.id] = Math.max(0, Math.min(1, parsed.score));
      reasonings[r.testCase.id] = parsed.reasoning;
    }
  }

  // Step 3: Save individual evaluations to DB
  let totalLatency = 0;
  let totalTokens = 0;

  for (const r of responses) {
    queries.createEvaluation({
      promptId: prompt.id,
      testCaseId: r.testCase.id,
      response: r.response,
      score: scores[r.testCase.id] ?? 0,
      judgeReasoning: reasonings[r.testCase.id] ?? "",
      latencyMs: r.latencyMs,
      tokensUsed: r.tokensUsed,
    });
    totalLatency += r.latencyMs;
    totalTokens += r.tokensUsed;
  }

  // Step 4: Compute weighted average fitness
  let totalScore = 0;
  let totalWeight = 0;

  for (const tc of testCases) {
    const weight = tc.weight;
    totalScore += (scores[tc.id] ?? 0) * weight;
    totalWeight += weight;
  }

  const fitness = totalWeight > 0 ? totalScore / totalWeight : 0;

  const metadata: PromptMetadata = {
    scoresPerTestCase: scores,
    avgLatencyMs: totalLatency / responses.length,
    totalTokens,
    judgeReasonings: reasonings,
  };

  // Update prompt fitness in DB
  queries.updatePromptFitness(prompt.id, fitness, metadata);

  return {
    prompt: { ...prompt, fitness, metadata },
    fitness,
    metadata,
  };
}

/**
 * Parse batched judge JSON response.
 */
function parseBatchedJudgeResponse(
  response: string,
  testCases: TestCase[],
): Record<string, { score: number; reasoning: string }> {
  try {
    const parsed = JSON.parse(response);
    if (parsed.evaluations && typeof parsed.evaluations === "object") {
      return parsed.evaluations;
    }
    // Sometimes the LLM returns the evaluations at the top level
    if (typeof parsed === "object" && !Array.isArray(parsed)) {
      const firstKey = Object.keys(parsed)[0];
      if (firstKey && typeof parsed[firstKey] === "object" && "score" in parsed[firstKey]) {
        return parsed;
      }
    }
  } catch {
    // Try extracting JSON from response
    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.evaluations) return parsed.evaluations;
        return parsed;
      } catch {
        // Fall through
      }
    }
  }

  // Fallback: return 0 scores for all test cases
  const fallback: Record<string, { score: number; reasoning: string }> = {};
  for (const tc of testCases) {
    fallback[tc.id] = { score: 0, reasoning: "Failed to parse judge response" };
  }
  return fallback;
}

/**
 * Parse individual judge JSON response.
 */
function parseIndividualJudgeResponse(response: string): { score: number; reasoning: string } {
  try {
    const parsed = JSON.parse(response);
    if (typeof parsed.score === "number") {
      return { score: parsed.score, reasoning: parsed.reasoning ?? "" };
    }
  } catch {
    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (typeof parsed.score === "number") {
          return { score: parsed.score, reasoning: parsed.reasoning ?? "" };
        }
      } catch {
        // Fall through
      }
    }

    // Try extracting score from text
    const scoreMatch = response.match(/(?:score|rating)[:\s]*([0-9.]+)/i);
    if (scoreMatch) {
      return { score: parseFloat(scoreMatch[1]), reasoning: "Extracted from text" };
    }
  }

  return { score: 0, reasoning: "Failed to parse judge response" };
}
