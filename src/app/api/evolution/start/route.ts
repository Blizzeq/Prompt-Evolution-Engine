import { NextResponse } from "next/server";
import { startEvolutionSchema } from "@/lib/engine/validation";
import { GemmaClient } from "@/lib/ai/client";
import { EvolutionEngine } from "@/lib/engine/evolution-loop";
import { registerRun } from "@/lib/engine/run-registry";
import { buildTestCaseGeneratorPrompt } from "@/lib/ai/prompts";
import * as queries from "@/lib/db/queries";
import { getConfig } from "@/lib/utils/config";
import {
  enforceRouteRateLimit,
  isLocalOriginRequest,
  normalizeOllamaBaseUrl,
  requireTrustedLocalRequest,
} from "@/lib/utils/request-security";
import type { EvolutionConfig } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const accessError = requireTrustedLocalRequest(request, "Evolution start");
  if (accessError) {
    return accessError;
  }

  const rateLimitError = enforceRouteRateLimit(request, "evolution-start", {
    limit: 5,
    windowMs: 60_000,
  });
  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const body = await request.json();
    const parsed = startEvolutionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      mode,
      userPrompt,
      context,
      taskDescription: rawTaskDescription,
      testCases: providedTestCases,
      seedPrompts: rawSeedPrompts,
      config: userConfig,
    } = parsed.data;
    const envConfig = getConfig();
    const requestIsLocalOrigin = isLocalOriginRequest(request);

    // Resolve model ID defaults per provider
    const provider = userConfig.provider ?? envConfig.provider;
    const defaultModelId = provider === "google-ai-studio"
      ? "gemini-2.5-flash"
      : provider === "openrouter"
        ? "google/gemma-4-26b-a4b-it:free"
        : "gemma4";

    const ALL_MUTATION_STRATEGIES = [
      "rephrase", "add-constraint", "remove-constraint",
      "reorder", "tone-shift", "add-example", "meta-mutation",
    ] as const;

    // Build full config with defaults
    const config: EvolutionConfig = {
      populationSize: userConfig.populationSize ?? (mode === "quick" ? 6 : 8),
      generations: userConfig.generations ?? (mode === "quick" ? 5 : 10),
      mutationRate: userConfig.mutationRate ?? 0.3,
      eliteCount: userConfig.eliteCount ?? 2,
      eaVariant: userConfig.eaVariant ?? "ga",
      evalMethod: userConfig.evalMethod ?? "llm-judge",
      modelId: userConfig.modelId ?? defaultModelId,
      provider,
      crossoverStrategy: userConfig.crossoverStrategy ?? "section-aware",
      mutationStrategies: userConfig.mutationStrategies ?? [...ALL_MUTATION_STRATEGIES],
      fitnessThreshold: userConfig.fitnessThreshold ?? 0.99,
      earlyStopGenerations: userConfig.earlyStopGenerations ?? 3,
      batchTestCases: userConfig.batchTestCases ?? true,
      combinedEval: userConfig.combinedEval ?? (provider !== "ollama"),
      delayBetweenCalls: userConfig.delayBetweenCalls ?? (provider === "ollama" ? 0 : 4200),
      ollamaComputeMode: userConfig.ollamaComputeMode ?? "auto",
      ollamaNumGpuLayers: userConfig.ollamaNumGpuLayers ?? -1,
    };

    // Validate eliteCount < populationSize
    if (config.eliteCount >= config.populationSize) {
      return NextResponse.json(
        { error: "eliteCount must be less than populationSize" },
        { status: 400 },
      );
    }

    if (config.eaVariant === "de") {
      return NextResponse.json(
        {
          error:
            "Differential Evolution is not exposed yet because the current engine does not implement a full DE runtime.",
        },
        { status: 400 },
      );
    }

    if (config.evalMethod === "semantic-similarity") {
      return NextResponse.json(
        {
          error:
            "semantic-similarity is not implemented yet. Use llm-judge, exact-match, or contains.",
        },
        { status: 400 },
      );
    }

    // Resolve API key based on provider
    const resolveApiKey = (): string => {
      if (userConfig.apiKey) return userConfig.apiKey;
      if (!requestIsLocalOrigin) return "";
      if (config.provider === "google-ai-studio") return envConfig.googleAiApiKey;
      if (config.provider === "openrouter") return envConfig.openrouterApiKey;
      return "";
    };

    if (config.provider !== "ollama" && !resolveApiKey()) {
      return NextResponse.json(
        {
          error:
            "API key required for cloud providers. Server-side fallback keys are only available from a local request.",
        },
        { status: 400 },
      );
    }

    const ollamaBaseUrl = config.provider === "ollama"
      ? normalizeOllamaBaseUrl(
        userConfig.ollamaBaseUrl ?? envConfig.ollamaBaseUrl,
      )
      : envConfig.ollamaBaseUrl;

    // Create AI client (used for both test case gen and evolution)
    const ai = new GemmaClient({
      provider: config.provider,
      modelId: config.modelId,
      apiKey: resolveApiKey(),
      ollamaBaseUrl,
      delayBetweenCalls: config.delayBetweenCalls,
      ollamaComputeMode: config.ollamaComputeMode,
      ollamaNumGpuLayers: config.ollamaNumGpuLayers,
    });

    // Determine task description
    let taskDescription = rawTaskDescription;
    if (mode === "quick" && context) {
      taskDescription = context;
    }

    // Determine seed prompts
    let seedPrompts = rawSeedPrompts ?? [];
    if (mode === "quick" && userPrompt) {
      // In quick mode, the user's prompt becomes the primary seed
      const normalizedPrompt = userPrompt.includes("{input}")
        ? userPrompt
        : `${userPrompt}\n\n{input}`;
      seedPrompts = [normalizedPrompt];
    }

    // Collect provided test cases (may be empty in quick mode)
    const testCases = providedTestCases;

    // Create run in DB immediately (fast — no LLM calls)
    const run = queries.createRun(
      taskDescription,
      config,
      userPrompt,
      "initializing",
    );

    // Save test cases if already available (from advanced mode)
    const hasTestCases = testCases.length >= 3;
    if (hasTestCases) {
      queries.createTestCases(
        run.id,
        testCases.map((tc) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          weight: tc.weight,
        })),
      );
    }

    // Create engine and register in run registry
    const engine = new EvolutionEngine(ai, config);
    registerRun(run.id, engine);

    // Fire and forget — generate test cases if needed, then run evolution
    (async () => {
      try {
        let resolvedTestCases = testCases;

        // Auto-generate test cases in background if needed
        if (!hasTestCases) {
          let generatedCases: typeof testCases = [];

          for (let attempt = 0; attempt < 2 && generatedCases.length < 3; attempt++) {
            if (ai.signal.aborted) {
              break;
            }

            try {
              const genPrompt = buildTestCaseGeneratorPrompt(
                taskDescription,
                userPrompt,
                5,
              );
              const result = await ai.generate({
                prompt: genPrompt,
                temperature: attempt === 0 ? 0.7 : 0.3,
                jsonMode: true,
                maxTokens: 4096,
              });

              console.log(`[Start] Test case generation attempt ${attempt + 1}, response length: ${result.text.length}`);
              const generated = parseTestCaseResponse(result.text);
              console.log(`[Start] Parsed ${generated.length} test cases from LLM`);

              if (generated.length >= 3) {
                generatedCases = generated;
                break;
              }
            } catch (error) {
              console.error(`[Start] Test case generation attempt ${attempt + 1} failed:`, error);
            }
          }

          // Fallback if LLM generation didn't produce enough cases
          if (!ai.signal.aborted && generatedCases.length < 3) {
            console.log("[Start] Using fallback test cases");
            generatedCases = generateFallbackTestCases(taskDescription);
          }

          resolvedTestCases = generatedCases;
        }

        if (ai.signal.aborted) {
          queries.updateRunProgress(run.id, {
            status: "stopped",
            stoppedReason: "user-stopped",
            completedAt: new Date().toISOString(),
            totalApiCalls: ai.getCallCount(),
            totalTokensUsed: ai.getTotalTokensUsed(),
          });
          return;
        }

        if (!hasTestCases) {
          queries.createTestCases(
            run.id,
            resolvedTestCases.map((tc) => ({
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              weight: tc.weight,
            })),
          );
        }

        await engine.run(run.id, seedPrompts);
      } catch (error) {
        console.error(`[Evolution ${run.id}] Fatal error:`, error);

        const message = error instanceof Error ? error.message : String(error);
        queries.updateRunProgress(run.id, {
          status: ai.signal.aborted ? "stopped" : "failed",
          stoppedReason: ai.signal.aborted ? "user-stopped" : undefined,
          error: ai.signal.aborted ? undefined : message,
          completedAt: new Date().toISOString(),
          totalApiCalls: ai.getCallCount(),
          totalTokensUsed: ai.getTotalTokensUsed(),
        });
      }
    })();

    // Return immediately — client redirects to /run/[id] right away
    return NextResponse.json({
      runId: run.id,
      status: "initializing",
      streamUrl: `/api/evolution/${run.id}/stream`,
      testCasesPending: !hasTestCases,
      testCaseCount: hasTestCases ? testCases.length : null,
    });
  } catch (error) {
    console.error("[Evolution Start] Error:", error);
    return NextResponse.json(
      { error: `Failed to start evolution: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    );
  }
}

/** Parse auto-generated test cases from LLM JSON response */
function parseTestCaseResponse(
  response: string,
): Array<{ input: string; expectedOutput: string; weight: number }> {
  try {
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          (tc) =>
            tc &&
            typeof tc.input === "string" &&
            typeof tc.expectedOutput === "string" &&
            tc.input.trim().length > 0 &&
            tc.expectedOutput.trim().length > 0,
        )
        .map((tc) => ({
          input: tc.input.trim(),
          expectedOutput: tc.expectedOutput.trim(),
          weight: typeof tc.weight === "number" ? tc.weight : 1.0,
        }));
    }
  } catch {
    // Try extracting JSON array from response
    const match = response.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return parseTestCaseResponse(match[0]);
      } catch {
        // Fall through
      }
    }
  }
  return [];
}

/** Generate minimal fallback test cases when LLM generation fails */
function generateFallbackTestCases(
  taskDescription: string,
): Array<{ input: string; expectedOutput: string; weight: number }> {
  // Try to generate relevant test cases based on task keywords
  const desc = taskDescription.toLowerCase();

  if (desc.includes("sentiment") || desc.includes("classify")) {
    return [
      { input: "I love this product, it's amazing!", expectedOutput: "positive", weight: 1.0 },
      { input: "Terrible experience, would not recommend.", expectedOutput: "negative", weight: 1.0 },
      { input: "The package arrived on Tuesday.", expectedOutput: "neutral", weight: 1.0 },
      { input: "Not bad, but could be better.", expectedOutput: "neutral", weight: 1.0 },
    ];
  }

  if (desc.includes("summar")) {
    return [
      { input: "The company reported Q3 revenue of $10B, up 15% year-over-year, driven by strong cloud growth.", expectedOutput: "Company Q3 revenue reached $10B with 15% YoY growth from cloud.", weight: 1.0 },
      { input: "Researchers found that regular exercise reduces heart disease risk by 30% according to a 20-year study.", expectedOutput: "A 20-year study shows regular exercise cuts heart disease risk by 30%.", weight: 1.0 },
      { input: "The city council approved a $50M budget for new park construction, with work starting in spring.", expectedOutput: "City council greenlit $50M for new parks, construction begins in spring.", weight: 1.0 },
    ];
  }

  if (desc.includes("extract") || desc.includes("entity")) {
    return [
      { input: "John Smith is the CEO of Acme Corp based in New York.", expectedOutput: '{"name": "John Smith", "role": "CEO", "company": "Acme Corp"}', weight: 1.0 },
      { input: "Dr. Maria Garcia leads the research team at Stanford University.", expectedOutput: '{"name": "Dr. Maria Garcia", "role": "research lead", "company": "Stanford University"}', weight: 1.0 },
      { input: "Sarah Chen, a senior engineer at Google, presented the new feature.", expectedOutput: '{"name": "Sarah Chen", "role": "senior engineer", "company": "Google"}', weight: 1.0 },
    ];
  }

  if (desc.includes("translat")) {
    return [
      { input: "Hello, how are you?", expectedOutput: "A natural, accurate translation of the greeting.", weight: 1.0 },
      { input: "The meeting has been rescheduled to next Monday.", expectedOutput: "A clear, accurate translation of the schedule change.", weight: 1.0 },
      { input: "Please review and approve the attached document.", expectedOutput: "A professional, accurate translation of the request.", weight: 1.0 },
    ];
  }

  // Generic fallback based on task description
  return [
    { input: "Simple example input for testing.", expectedOutput: "A correct, well-formatted response for the given task.", weight: 1.0 },
    { input: "A moderately complex input that tests the prompt's ability to handle detail.", expectedOutput: "A thorough, accurate response that addresses all aspects of the input.", weight: 1.0 },
    { input: "An edge case input to test robustness and error handling.", expectedOutput: "A graceful, appropriate response even for unusual input.", weight: 1.0 },
  ];
}
