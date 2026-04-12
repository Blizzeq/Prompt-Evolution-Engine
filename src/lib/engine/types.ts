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
  modelId: ModelId;
  provider: "ollama" | "google-ai-studio" | "openrouter";
  crossoverStrategy: CrossoverStrategy;
  mutationStrategies: MutationType[];
  fitnessThreshold: number;     // target fitness for early stop, default: 0.99
  earlyStopGenerations: number; // stop if no improvement for N gens, default: 3
  batchTestCases: boolean;      // batch test cases in one LLM call, default: true
  combinedEval: boolean;        // combined simulate+judge in 1 call per prompt, default: false
  delayBetweenCalls: number;    // ms delay between API calls, default: 500
  ollamaComputeMode: OllamaComputeMode;  // CPU/GPU selection for Ollama
  ollamaNumGpuLayers: number;   // custom GPU layers for hybrid mode (-1=all, 0=none)
}

// Flexible model identifier — any model supported by the chosen provider
export type ModelId = string;

// Well-known model presets per provider (for UI dropdowns)
export const MODEL_PRESETS = {
  ollama: [
    { id: "gemma4", label: "Gemma 4 (recommended)", description: "Google Gemma 4 MoE" },
    { id: "gemma4:27b", label: "Gemma 4 27B", description: "Larger Gemma variant" },
    { id: "gemma3", label: "Gemma 3", description: "Google Gemma 3" },
    { id: "llama3.1", label: "Llama 3.1 8B", description: "Meta Llama 3.1" },
    { id: "mistral", label: "Mistral 7B", description: "Mistral AI" },
    { id: "phi4", label: "Phi 4", description: "Microsoft Phi 4" },
    { id: "qwen3", label: "Qwen 3", description: "Alibaba Qwen 3" },
  ],
  "google-ai-studio": [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (recommended)", description: "Fast, free tier, thinking model" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Most capable, thinking model" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", description: "Previous gen, fast" },
    { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", description: "Lightweight, fastest" },
    { id: "gemma-3-27b-it", label: "Gemma 3 27B", description: "Open model, 27B params" },
    { id: "gemma-3-12b-it", label: "Gemma 3 12B", description: "Open model, 12B params" },
    { id: "gemma-3-4b-it", label: "Gemma 3 4B", description: "Open model, compact" },
  ],
  openrouter: [
    { id: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B (free)", description: "Google, free tier" },
    { id: "google/gemma-3-27b-it:free", label: "Gemma 3 27B (free)", description: "Google, free tier" },
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Google, paid" },
    { id: "meta-llama/llama-4-maverick:free", label: "Llama 4 Maverick (free)", description: "Meta, free tier" },
    { id: "deepseek/deepseek-chat-v3-0324:free", label: "DeepSeek V3 (free)", description: "DeepSeek, free tier" },
  ],
} as const;

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
