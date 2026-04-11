import { NextResponse } from "next/server";
import { startEvolutionSchema } from "@/lib/engine/validation";
import { GemmaClient } from "@/lib/ai/client";
import { EvolutionEngine } from "@/lib/engine/evolution-loop";
import { registerRun } from "@/lib/engine/run-registry";
import * as queries from "@/lib/db/queries";
import { getConfig } from "@/lib/utils/config";
import type { EvolutionConfig } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = startEvolutionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { taskDescription, testCases, seedPrompts, config: userConfig } = parsed.data;
    const envConfig = getConfig();

    const ALL_MUTATION_STRATEGIES = [
      "rephrase", "add-constraint", "remove-constraint",
      "reorder", "tone-shift", "add-example", "meta-mutation",
    ] as const;

    // Build full config with defaults
    const config: EvolutionConfig = {
      populationSize: userConfig.populationSize ?? 8,
      generations: userConfig.generations ?? 10,
      mutationRate: userConfig.mutationRate ?? 0.3,
      eliteCount: userConfig.eliteCount ?? 2,
      eaVariant: userConfig.eaVariant ?? "ga",
      evalMethod: userConfig.evalMethod ?? "llm-judge",
      modelId: userConfig.modelId ?? envConfig.modelId,
      provider: userConfig.provider ?? envConfig.provider,
      crossoverStrategy: userConfig.crossoverStrategy ?? "simple",
      mutationStrategies: userConfig.mutationStrategies ?? [...ALL_MUTATION_STRATEGIES],
      fitnessThreshold: userConfig.fitnessThreshold ?? 0.1,
      earlyStopGenerations: userConfig.earlyStopGenerations ?? 3,
      batchTestCases: userConfig.batchTestCases ?? true,
      delayBetweenCalls: userConfig.delayBetweenCalls ?? envConfig.delayBetweenCalls,
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

    // Create run and test cases in DB
    const run = queries.createRun(taskDescription, config);
    queries.createTestCases(
      run.id,
      testCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        weight: tc.weight,
      })),
    );

    // Resolve API key based on provider
    const resolveApiKey = (): string => {
      if (userConfig.apiKey) return userConfig.apiKey;
      if (config.provider === "google-ai-studio") return envConfig.googleAiApiKey;
      if (config.provider === "openrouter") return envConfig.openrouterApiKey;
      return "";
    };

    // Create AI client
    const ai = new GemmaClient({
      provider: config.provider,
      modelId: config.modelId,
      apiKey: resolveApiKey(),
      ollamaBaseUrl: userConfig.ollamaBaseUrl ?? envConfig.ollamaBaseUrl,
      delayBetweenCalls: config.delayBetweenCalls,
      ollamaComputeMode: config.ollamaComputeMode,
      ollamaNumGpuLayers: config.ollamaNumGpuLayers,
    });

    // Create engine and register in run registry
    const engine = new EvolutionEngine(ai, config);
    registerRun(run.id, engine);

    // Fire and forget — run in background
    engine.run(run.id, seedPrompts ?? []).catch((error) => {
      console.error(`[Evolution ${run.id}] Fatal error:`, error);
    });

    return NextResponse.json({
      runId: run.id,
      status: "initializing",
      streamUrl: `/api/evolution/${run.id}/stream`,
    });
  } catch (error) {
    console.error("[Evolution Start] Error:", error);
    return NextResponse.json(
      { error: "Failed to start evolution" },
      { status: 500 },
    );
  }
}
