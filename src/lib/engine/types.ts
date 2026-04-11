// Core domain types for the Prompt Evolution Engine

// ═══════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════

export interface EvolutionConfig {
  populationSize: number;       // 4–16, default: 8
  generations: number;          // 3–30, default: 10
  mutationRate: number;         // 0.0–1.0, default: 0.3
  eliteCount: number;           // 1–4, default: 2
  eaVariant: "ga" | "de";
  evalMethod: EvalMethod;
  modelId: GemmaModelId;
  provider: "ollama" | "google-ai-studio" | "openrouter";
  crossoverStrategy: CrossoverStrategy;
  mutationStrategies: MutationType[];
  fitnessThreshold: number;     // min fitness to survive, default: 0.1
  earlyStopGenerations: number; // stop if no improvement for N gens, default: 3
  batchTestCases: boolean;      // batch test cases in one LLM call, default: true
  delayBetweenCalls: number;    // ms delay between API calls, default: 500
  ollamaComputeMode: OllamaComputeMode;  // CPU/GPU selection for Ollama
  ollamaNumGpuLayers: number;   // custom GPU layers for hybrid mode (-1=all, 0=none)
}

export type GemmaModelId =
  | "gemma4"                // Gemma 4 default (MoE, recommended)
  | "gemma4:27b";           // Gemma 4 27B (larger variant)

export type OllamaComputeMode =
  | "auto"                  // Let Ollama decide (GPU if available, else CPU)
  | "gpu"                   // Force all layers to GPU
  | "cpu"                   // Force CPU-only inference
  | "hybrid";               // Custom GPU/CPU split (user sets layer count)

export type EvalMethod =
  | "llm-judge"
  | "exact-match"
  | "contains"
  | "semantic-similarity";

export type CrossoverStrategy =
  | "simple"
  | "section-aware"
  | "differential";

export type MutationType =
  | "rephrase"
  | "add-constraint"
  | "remove-constraint"
  | "reorder"
  | "tone-shift"
  | "add-example"
  | "meta-mutation";

// ═══════════════════════════════════════════
// Core Entities
// ═══════════════════════════════════════════

export interface EvolutionRun {
  id: string;
  taskDescription: string;
  config: EvolutionConfig;
  status: RunStatus;
  currentGeneration: number;
  bestFitness: number | null;
  bestPromptId: string | null;
  totalApiCalls: number;
  totalTokensUsed: number;
  startedAt: string;
  completedAt: string | null;
  stoppedReason: StopReason | null;
  error: string | null;
}

export type RunStatus =
  | "pending"
  | "initializing"
  | "running"
  | "completed"
  | "stopped"
  | "failed";

export type StopReason =
  | "user-stopped"
  | "early-convergence"
  | "fitness-reached"
  | "api-error";

export interface TestCase {
  id: string;
  runId: string;
  input: string;
  expectedOutput: string;
  weight: number;
}

export interface Prompt {
  id: string;
  runId: string;
  generation: number;
  text: string;
  fitness: number | null;
  parentIds: string[];
  origin: PromptOrigin;
  metadata: PromptMetadata | null;
}

export type PromptOrigin =
  | { type: "seed"; source: "user" | "generated" }
  | { type: "crossover"; parents: [string, string]; strategy: CrossoverStrategy }
  | { type: "mutation"; parent: string; mutationType: MutationType }
  | { type: "elite"; originalId: string };

export interface PromptMetadata {
  scoresPerTestCase: Record<string, number>;
  avgLatencyMs: number;
  totalTokens: number;
  judgeReasonings: Record<string, string>;
}

export interface Evaluation {
  id: string;
  promptId: string;
  testCaseId: string;
  response: string;
  score: number;
  judgeReasoning: string;
  latencyMs: number;
  tokensUsed: number;
}

// ═══════════════════════════════════════════
// SSE Events
// ═══════════════════════════════════════════

export type EvolutionEvent =
  | { type: "run:started"; runId: string }
  | { type: "generation:started"; generation: number; totalGenerations: number }
  | { type: "evaluation:progress"; generation: number; evaluated: number; total: number }
  | { type: "evaluation:complete"; generation: number; results: GenerationSummary }
  | { type: "selection:complete"; generation: number; parents: ParentPair[] }
  | { type: "offspring:created"; generation: number; prompt: Prompt }
  | { type: "generation:complete"; generation: number; summary: GenerationSummary }
  | { type: "run:completed"; summary: RunSummary }
  | { type: "run:stopped"; reason: StopReason }
  | { type: "run:error"; error: string }
  | { type: "api:call"; callNumber: number; purpose: string };

export interface GenerationSummary {
  generation: number;
  bestFitness: number;
  meanFitness: number;
  worstFitness: number;
  bestPrompt: Prompt;
  populationSize: number;
  apiCallsThisGen: number;
  durationMs: number;
}

export interface ParentPair {
  parent1Id: string;
  parent2Id: string;
  offspringType: "crossover" | "mutation";
}

export interface RunSummary {
  totalGenerations: number;
  totalApiCalls: number;
  totalTokensUsed: number;
  totalDurationMs: number;
  bestPrompt: Prompt;
  seedBestFitness: number;
  finalBestFitness: number;
  improvementPercent: number;
  convergenceGeneration: number | null;
  fitnessHistory: { generation: number; best: number; mean: number; worst: number }[];
}

// ═══════════════════════════════════════════
// Presets
// ═══════════════════════════════════════════

export interface TaskPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  taskDescription: string;
  testCases: Omit<TestCase, "id" | "runId">[];
  suggestedConfig: Partial<EvolutionConfig>;
  seedPrompts?: string[];
}
