import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { EvolutionConfig, PromptOrigin, PromptMetadata } from "@/lib/engine/types";

export const evolutionRuns = sqliteTable(
  "evolution_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    taskDescription: text("task_description").notNull(),
    userPrompt: text("user_prompt"),
    config: text("config", { mode: "json" }).notNull().$type<EvolutionConfig>(),
    status: text("status", {
      enum: ["pending", "initializing", "running", "completed", "stopped", "failed"],
    }).notNull().default("pending"),
    currentGeneration: integer("current_generation").notNull().default(0),
    bestFitness: real("best_fitness"),
    bestPromptId: text("best_prompt_id"),
    totalApiCalls: integer("total_api_calls").notNull().default(0),
    totalTokensUsed: integer("total_tokens_used").notNull().default(0),
    startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
    completedAt: text("completed_at"),
    stoppedReason: text("stopped_reason"),
    error: text("error"),
  },
  (table) => ({
    startedAtIdx: index("evolution_runs_started_at_idx").on(table.startedAt),
  }),
);

export const testCases = sqliteTable(
  "test_cases",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id").notNull().references(() => evolutionRuns.id, { onDelete: "cascade" }),
    input: text("input").notNull(),
    expectedOutput: text("expected_output").notNull(),
    weight: real("weight").notNull().default(1.0),
  },
  (table) => ({
    runIdIdx: index("test_cases_run_id_idx").on(table.runId),
  }),
);

export const prompts = sqliteTable(
  "prompts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id").notNull().references(() => evolutionRuns.id, { onDelete: "cascade" }),
    generation: integer("generation").notNull(),
    text: text("text").notNull(),
    fitness: real("fitness"),
    parentIds: text("parent_ids", { mode: "json" }).$type<string[]>().notNull().default([]),
    origin: text("origin", { mode: "json" }).$type<PromptOrigin>().notNull(),
    metadata: text("metadata", { mode: "json" }).$type<PromptMetadata>(),
  },
  (table) => ({
    runIdIdx: index("prompts_run_id_idx").on(table.runId),
    runGenerationIdx: index("prompts_run_generation_idx").on(
      table.runId,
      table.generation,
    ),
  }),
);

export const evaluations = sqliteTable(
  "evaluations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    promptId: text("prompt_id").notNull().references(() => prompts.id, { onDelete: "cascade" }),
    testCaseId: text("test_case_id").notNull().references(() => testCases.id, { onDelete: "cascade" }),
    response: text("response").notNull(),
    score: real("score").notNull(),
    judgeReasoning: text("judge_reasoning").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    tokensUsed: integer("tokens_used").notNull(),
  },
  (table) => ({
    promptIdIdx: index("evaluations_prompt_id_idx").on(table.promptId),
  }),
);
