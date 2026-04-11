import { eq, desc } from "drizzle-orm";
import { db } from "./client";
import { evolutionRuns, testCases, prompts, evaluations } from "./schema";
import type { EvolutionConfig, PromptOrigin, PromptMetadata, RunStatus, StopReason } from "@/lib/engine/types";

// ═══════════════════════════════════════════
// Evolution Runs
// ═══════════════════════════════════════════

export function createRun(taskDescription: string, config: EvolutionConfig) {
  const rows = db.insert(evolutionRuns).values({ taskDescription, config }).returning().all();
  return rows[0];
}

export function getRun(id: string) {
  const rows = db.select().from(evolutionRuns).where(eq(evolutionRuns.id, id)).all();
  return rows[0] ?? null;
}

export function listRuns() {
  return db.select().from(evolutionRuns).orderBy(desc(evolutionRuns.startedAt)).all();
}

export function updateRunStatus(id: string, status: RunStatus) {
  db.update(evolutionRuns).set({ status }).where(eq(evolutionRuns.id, id)).run();
}

export function deleteRun(id: string) {
  db.delete(evolutionRuns).where(eq(evolutionRuns.id, id)).run();
}

export function updateRunProgress(id: string, data: {
  currentGeneration?: number;
  bestFitness?: number;
  bestPromptId?: string;
  totalApiCalls?: number;
  totalTokensUsed?: number;
  status?: RunStatus;
  completedAt?: string;
  stoppedReason?: StopReason;
  error?: string;
}) {
  db.update(evolutionRuns).set(data).where(eq(evolutionRuns.id, id)).run();
}

// ═══════════════════════════════════════════
// Test Cases
// ═══════════════════════════════════════════

export function createTestCases(runId: string, cases: { input: string; expectedOutput: string; weight: number }[]) {
  if (cases.length === 0) return [];
  const values = cases.map((c) => ({ ...c, runId }));
  return db.insert(testCases).values(values).returning().all();
}

export function getTestCasesForRun(runId: string) {
  return db.select().from(testCases).where(eq(testCases.runId, runId)).all();
}

// ═══════════════════════════════════════════
// Prompts
// ═══════════════════════════════════════════

export function createPrompt(data: {
  runId: string;
  generation: number;
  text: string;
  origin: PromptOrigin;
  parentIds?: string[];
  fitness?: number;
  metadata?: PromptMetadata;
}) {
  const rows = db.insert(prompts).values({
    ...data,
    parentIds: data.parentIds ?? [],
  }).returning().all();
  return rows[0];
}

export function updatePromptFitness(id: string, fitness: number, metadata: PromptMetadata) {
  db.update(prompts).set({ fitness, metadata }).where(eq(prompts.id, id)).run();
}

export function getPromptsForRun(runId: string) {
  return db.select().from(prompts).where(eq(prompts.runId, runId)).all();
}

export function getPromptsForGeneration(runId: string, generation: number) {
  return db.select().from(prompts)
    .where(eq(prompts.runId, runId))
    .all()
    .filter((p) => p.generation === generation);
}

// ═══════════════════════════════════════════
// Evaluations
// ═══════════════════════════════════════════

export function createEvaluation(data: {
  promptId: string;
  testCaseId: string;
  response: string;
  score: number;
  judgeReasoning: string;
  latencyMs: number;
  tokensUsed: number;
}) {
  const rows = db.insert(evaluations).values(data).returning().all();
  return rows[0];
}

export function getEvaluationsForPrompt(promptId: string) {
  return db.select().from(evaluations).where(eq(evaluations.promptId, promptId)).all();
}
