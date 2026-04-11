import { z } from "zod";

export const startEvolutionSchema = z.object({
  taskDescription: z
    .string()
    .min(10, "Task description must be at least 10 characters")
    .max(2000, "Task description must be at most 2000 characters"),

  testCases: z
    .array(
      z.object({
        input: z.string().min(1).max(5000),
        expectedOutput: z.string().min(1).max(2000),
        weight: z.number().min(0).max(10).default(1.0),
      }),
    )
    .min(3, "At least 3 test cases required")
    .max(20, "At most 20 test cases"),

  seedPrompts: z
    .array(
      z
        .string()
        .max(2000)
        .refine((s) => s.includes("{input}"), "Seed prompt must contain {input} placeholder"),
    )
    .max(4)
    .optional(),

  config: z
    .object({
      populationSize: z.number().int().min(4).max(16).optional(),
      generations: z.number().int().min(3).max(30).optional(),
      mutationRate: z.number().min(0).max(1).optional(),
      eliteCount: z.number().int().min(1).max(4).optional(),
      eaVariant: z.enum(["ga", "de"]).optional(),
      evalMethod: z.enum(["llm-judge", "exact-match", "contains", "semantic-similarity"]).optional(),
      modelId: z.enum(["gemma4", "gemma4:27b"]).optional(),
      provider: z.enum(["ollama", "google-ai-studio", "openrouter"]).optional(),
      crossoverStrategy: z.enum(["simple", "section-aware", "differential"]).optional(),
      mutationStrategies: z
        .array(z.enum(["rephrase", "add-constraint", "remove-constraint", "reorder", "tone-shift", "add-example", "meta-mutation"]))
        .min(1)
        .optional(),
      fitnessThreshold: z.number().min(0).max(1).optional(),
      earlyStopGenerations: z.number().int().min(1).max(10).optional(),
      batchTestCases: z.boolean().optional(),
      delayBetweenCalls: z.number().int().min(0).max(30000).optional(),
      ollamaComputeMode: z.enum(["auto", "gpu", "cpu", "hybrid"]).optional(),
      ollamaNumGpuLayers: z.number().int().min(0).max(200).optional(),
      apiKey: z.string().optional(),
      ollamaBaseUrl: z.string().optional(),
    })
    .default({}),
});

export type StartEvolutionRequest = z.infer<typeof startEvolutionSchema>;
