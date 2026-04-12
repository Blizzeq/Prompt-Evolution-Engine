import type { GemmaClient } from "@/lib/ai/client";
import type { EvalMethod, Prompt, TestCase, PromptMetadata } from "./types";
import { buildBatchedJudgePrompt, buildJudgePrompt, buildCombinedEvaluatePrompt } from "@/lib/ai/prompts";
import * as queries from "@/lib/db/queries";

interface EvaluationResult {
  prompt: Prompt;
  fitness: number;
  metadata: PromptMetadata;
}

/**
 * Evaluate a single prompt — auto-selects between combined (1 API call)
 * and full mode (N+1 API calls) based on the combinedEval flag.
 */
export async function evaluatePrompt(
  ai: GemmaClient,
  prompt: Prompt,
  testCases: TestCase[],
  taskDescription: string,
  batchJudging: boolean,
  combinedEval: boolean = false,
  evalMethod: EvalMethod = "llm-judge",
): Promise<EvaluationResult> {
  if (evalMethod !== "llm-judge") {
    return evaluatePromptFull(
      ai,
      prompt,
      testCases,
      taskDescription,
      batchJudging,
      evalMethod,
    );
  }

  if (combinedEval) {
    return evaluatePromptCombined(ai, prompt, testCases, taskDescription);
  }

  return evaluatePromptFull(
    ai,
    prompt,
    testCases,
    taskDescription,
    batchJudging,
    evalMethod,
  );
}

/**
 * Combined evaluation: 1 API call per prompt.
 * LLM simulates execution and judges results in a single call.
 * Best for rate-limited cloud providers (OpenRouter free tier).
 */
async function evaluatePromptCombined(
  ai: GemmaClient,
  prompt: Prompt,
  testCases: TestCase[],
  taskDescription: string,
): Promise<EvaluationResult> {
  if (!prompt.text) {
    console.error(`[Fitness] Prompt ${prompt.id} has empty text, skipping evaluation`);
    return {
      prompt: { ...prompt, fitness: 0, metadata: null },
      fitness: 0,
      metadata: { scoresPerTestCase: {}, avgLatencyMs: 0, totalTokens: 0, judgeReasonings: {} },
    };
  }

  const evalPrompt = buildCombinedEvaluatePrompt(
    taskDescription,
    prompt.text,
    testCases.map((tc) => ({
      id: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
    })),
  );

  const result = await ai.generate({
    prompt: evalPrompt,
    temperature: 0.0,
    jsonMode: true,
    maxTokens: 2048,
  });

  const judgeData = parseBatchedJudgeResponse(result.text, testCases);
  const scores: Record<string, number> = {};
  const reasonings: Record<string, string> = {};

  for (const tc of testCases) {
    const evaluation = judgeData[tc.id] ?? { score: 0, reasoning: "Failed to parse" };
    scores[tc.id] = Math.max(0, Math.min(1, evaluation.score));
    reasonings[tc.id] = evaluation.reasoning;
  }

  // Save evaluations to DB (with simulated response)
  for (const tc of testCases) {
    queries.createEvaluation({
      promptId: prompt.id,
      testCaseId: tc.id,
      response: `[combined-eval] score=${scores[tc.id]?.toFixed(2)}`,
      score: scores[tc.id] ?? 0,
      judgeReasoning: reasonings[tc.id] ?? "",
      latencyMs: result.latencyMs,
      tokensUsed: Math.round(result.tokensUsed / testCases.length),
    });
  }

  // Compute weighted fitness
  let totalScore = 0;
  let totalWeight = 0;
  for (const tc of testCases) {
    totalScore += (scores[tc.id] ?? 0) * tc.weight;
    totalWeight += tc.weight;
  }
  const fitness = totalWeight > 0 ? totalScore / totalWeight : 0;

  const metadata: PromptMetadata = {
    scoresPerTestCase: scores,
    avgLatencyMs: result.latencyMs,
    totalTokens: result.tokensUsed,
    judgeReasonings: reasonings,
  };

  queries.updatePromptFitness(prompt.id, fitness, metadata);

  return {
    prompt: { ...prompt, fitness, metadata },
    fitness,
    metadata,
  };
}

/**
 * Full evaluation: N exec calls + 1 judge call per prompt.
 * Best for local models (Ollama) where API calls are free.
 */
async function evaluatePromptFull(
  ai: GemmaClient,
  prompt: Prompt,
  testCases: TestCase[],
  taskDescription: string,
  batchJudging: boolean,
  evalMethod: EvalMethod,
): Promise<EvaluationResult> {
  if (!prompt.text) {
    console.error(`[Fitness] Prompt ${prompt.id} has empty text, skipping evaluation`);
    return {
      prompt: { ...prompt, fitness: 0, metadata: null },
      fitness: 0,
      metadata: { scoresPerTestCase: {}, avgLatencyMs: 0, totalTokens: 0, judgeReasonings: {} },
    };
  }

  // Step 1: Execute prompt against all test cases in parallel
  // GemmaClient's semaphore controls actual concurrency
  const responses = await Promise.all(
    testCases.map(async (tc) => {
      try {
        const promptWithInput = prompt.text.includes("{input}")
          ? prompt.text.replace("{input}", tc.input)
          : `${prompt.text}\n\nInput: ${tc.input}`;

        const result = await ai.generate({
          prompt: promptWithInput,
          temperature: 0.0,
          maxTokens: 512,
        });

        return {
          testCase: tc,
          response: result.text,
          latencyMs: result.latencyMs,
          tokensUsed: result.tokensUsed,
        };
      } catch (error) {
        console.error(`[Fitness] Failed to evaluate prompt ${prompt.id} on test case ${tc.id}:`, error);
        return {
          testCase: tc,
          response: `[Error: ${error instanceof Error ? error.message : "Unknown error"}]`,
          latencyMs: 0,
          tokensUsed: 0,
        };
      }
    }),
  );

  // Step 2: Judge responses
  const scores: Record<string, number> = {};
  const reasonings: Record<string, string> = {};
  let judgeTokens = 0;

  if (evalMethod === "exact-match" || evalMethod === "contains") {
    for (const r of responses) {
      const evaluation = scoreDeterministically(
        r.response,
        r.testCase.expectedOutput,
        evalMethod,
      );
      scores[r.testCase.id] = evaluation.score;
      reasonings[r.testCase.id] = evaluation.reasoning;
    }
  } else if (batchJudging && testCases.length > 1) {
    try {
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

      judgeTokens += judgeResult.tokensUsed;
      const judgeData = parseBatchedJudgeResponse(judgeResult.text, testCases);

      for (const tc of testCases) {
        const evaluation = judgeData[tc.id] ?? { score: 0, reasoning: "Failed to parse judge response" };
        scores[tc.id] = Math.max(0, Math.min(1, evaluation.score));
        reasonings[tc.id] = evaluation.reasoning;
      }
    } catch (error) {
      for (const tc of testCases) {
        scores[tc.id] = 0;
        reasonings[tc.id] = `Judge failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    }
  } else {
    const judgeResults = await Promise.allSettled(
      responses.map(async (r) => {
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
        return {
          testCaseId: r.testCase.id,
          score: Math.max(0, Math.min(1, parsed.score)),
          reasoning: parsed.reasoning,
          tokensUsed: judgeResult.tokensUsed,
        };
      }),
    );

    for (let index = 0; index < judgeResults.length; index++) {
      const outcome = judgeResults[index];
      const testCaseId = responses[index].testCase.id;

      if (outcome.status === "fulfilled") {
        scores[testCaseId] = outcome.value.score;
        reasonings[testCaseId] = outcome.value.reasoning;
        judgeTokens += outcome.value.tokensUsed;
        continue;
      }

      scores[testCaseId] = 0;
      reasonings[testCaseId] =
        outcome.reason instanceof Error
          ? outcome.reason.message
          : "Judge request failed";
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

  totalTokens += judgeTokens;

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

function scoreDeterministically(
  actualResponse: string,
  expectedOutput: string,
  method: Extract<EvalMethod, "exact-match" | "contains">,
): { score: number; reasoning: string } {
  const normalizedActual = normalizeComparableText(actualResponse);
  const normalizedExpected = normalizeComparableText(expectedOutput);

  if (!normalizedExpected) {
    return { score: 0, reasoning: "Expected output is empty" };
  }

  if (method === "exact-match") {
    const matches = normalizedActual === normalizedExpected;
    return {
      score: matches ? 1 : 0,
      reasoning: matches ? "Exact match" : "Response does not exactly match expected output",
    };
  }

  const contains = normalizedActual.includes(normalizedExpected);
  return {
    score: contains ? 1 : 0,
    reasoning: contains ? "Expected output is contained in the response" : "Response does not contain the expected output",
  };
}

function normalizeComparableText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
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
