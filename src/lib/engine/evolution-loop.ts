import type {
  EvolutionConfig,
  EvolutionEvent,
  GenerationSummary,
  Prompt,
  RunSummary,
  TestCase,
} from "./types";
import type { GemmaClient } from "@/lib/ai/client";
import { initializePopulation } from "./population";
import { evaluatePrompt } from "./fitness";
import { selectElites, tournamentSelect } from "./selection";
import { performCrossover } from "./crossover";
import { performMutation, selectMutationType } from "./mutation";
import * as queries from "@/lib/db/queries";
import { EvolutionError } from "@/lib/utils/errors";

type EventListener = (event: EvolutionEvent) => void;

export class EvolutionEngine {
  private aborted = false;
  private listeners: EventListener[] = [];

  constructor(
    private ai: GemmaClient,
    private config: EvolutionConfig,
  ) {}

  /**
   * Register a listener for evolution events (used by SSE).
   */
  onEvent(listener: EventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Stop the evolution and abort all in-flight AI requests.
   */
  stop(): void {
    this.aborted = true;
    this.ai.abort();
  }

  /**
   * Run the full evolution loop.
   */
  async run(runId: string, userSeeds: string[]): Promise<RunSummary> {
    const startTime = Date.now();

    try {
      const run = queries.getRun(runId);
      if (!run) throw new EvolutionError(`Run ${runId} not found`);

      const testCases = queries.getTestCasesForRun(runId) as TestCase[];
      if (testCases.length === 0) throw new EvolutionError("No test cases found");

      // Update status
      queries.updateRunProgress(runId, { status: "initializing" });
      this.emit({ type: "run:started", runId });

      // ══════════ Phase 1: Initialize Population ══════════
      let population = await initializePopulation(
        this.ai,
        runId,
        run.taskDescription,
        this.config.populationSize,
        userSeeds,
      );

      queries.updateRunProgress(runId, { status: "running" });

      // ══════════ Phase 2: Evolution Loop ══════════
      const fitnessHistory: GenerationSummary[] = [];
      let bestEverPrompt: Prompt | null = null;
      let noImprovementCount = 0;
      let currentMutationRate = this.config.mutationRate;

      for (let gen = 1; gen <= this.config.generations; gen++) {
        if (this.aborted) {
          this.emit({ type: "run:stopped", reason: "user-stopped" });
          queries.updateRunProgress(runId, {
            status: "stopped",
            stoppedReason: "user-stopped",
            currentGeneration: gen - 1,
            completedAt: new Date().toISOString(),
            totalApiCalls: this.ai.getCallCount(),
            totalTokensUsed: this.ai.getTotalTokensUsed(),
          });
          break;
        }

        const genStartTime = Date.now();

        this.emit({
          type: "generation:started",
          generation: gen,
          totalGenerations: this.config.generations,
        });

        // ── Step 1: Evaluate fitness (parallel for cloud, sequential for Ollama) ──
        // Re-evaluate elites every other generation to combat lucky scores
        const shouldReEvalElites = gen > 1 && gen % 2 === 0;
        if (shouldReEvalElites) {
          for (const p of population) {
            if (p.origin.type === "elite") {
              p.fitness = null;
            }
          }
        }
        const unevaluated = population.filter((p) => p.fitness === null);
        let evaluated = 0;

        // Fire all evaluations concurrently — GemmaClient's semaphore
        // controls actual parallelism (5 for cloud, 1 for Ollama)
        const evaluationResults = await Promise.all(
          unevaluated.map(async (prompt) => {
            if (this.aborted) {
              return { prompt, skipped: true };
            }

            try {
              const result = await evaluatePrompt(
                this.ai,
                prompt,
                testCases,
                run.taskDescription,
                this.config.batchTestCases,
                this.config.combinedEval ?? false,
                this.config.evalMethod,
              );

              return { prompt, result };
            } catch (error) {
              return { prompt, error };
            }
          }),
        );

        for (const outcome of evaluationResults) {
          if (outcome.skipped) {
            continue;
          }

          if (outcome.error) {
            const metadata = {
              scoresPerTestCase: {},
              avgLatencyMs: 0,
              totalTokens: 0,
              judgeReasonings: {
                error:
                  outcome.error instanceof Error
                    ? outcome.error.message
                    : "Evaluation failed",
              },
            };
            promptFailureFallback(outcome.prompt, metadata);
          } else if (outcome.result) {
            outcome.prompt.fitness = outcome.result.fitness;
            outcome.prompt.metadata = outcome.result.metadata;
          }

          evaluated++;
          this.emit({
            type: "evaluation:progress",
            generation: gen,
            evaluated,
            total: unevaluated.length,
          });
        }

        // ── Step 2: Sort by fitness ──
        population.sort((a, b) => (b.fitness ?? 0) - (a.fitness ?? 0));

        // ── Step 3: Generation summary ──
        const summary = computeGenerationSummary(population, gen, genStartTime);
        fitnessHistory.push(summary);

        this.emit({ type: "generation:complete", generation: gen, summary });

        // ── Step 4: Track best ever + adaptive mutation ──
        if (!bestEverPrompt || summary.bestFitness > (bestEverPrompt.fitness ?? 0)) {
          bestEverPrompt = { ...summary.bestPrompt };
          noImprovementCount = 0;
          // Reset mutation rate on improvement
          currentMutationRate = this.config.mutationRate;
        } else {
          noImprovementCount++;
          // Boost mutation rate when stagnating (max 0.7)
          currentMutationRate = Math.min(
            0.7,
            this.config.mutationRate + noImprovementCount * 0.15,
          );
        }

        // ── Step 5: Early stopping ──
        if (noImprovementCount >= this.config.earlyStopGenerations) {
          queries.updateRunProgress(runId, {
            currentGeneration: gen,
            stoppedReason: "early-convergence",
            bestFitness: bestEverPrompt?.fitness ?? undefined,
            bestPromptId: bestEverPrompt?.id ?? undefined,
            totalApiCalls: this.ai.getCallCount(),
            totalTokensUsed: this.ai.getTotalTokensUsed(),
          });
          break;
        }

        // Fitness threshold reached
        if (summary.bestFitness >= this.config.fitnessThreshold) {
          queries.updateRunProgress(runId, {
            currentGeneration: gen,
            stoppedReason: "fitness-reached",
            bestFitness: bestEverPrompt?.fitness ?? undefined,
            bestPromptId: bestEverPrompt?.id ?? undefined,
            totalApiCalls: this.ai.getCallCount(),
            totalTokensUsed: this.ai.getTotalTokensUsed(),
          });
          break;
        }

        // Last generation — don't create offspring
        if (gen === this.config.generations) break;

        // ── Step 6: Create next generation ──
        const nextGeneration = await this.createNextGeneration(
          population,
          runId,
          run.taskDescription,
          gen,
          currentMutationRate,
        );

        population = nextGeneration;

        // Save progress to DB
        queries.updateRunProgress(runId, {
          currentGeneration: gen,
          bestFitness: bestEverPrompt?.fitness ?? undefined,
          bestPromptId: bestEverPrompt?.id ?? undefined,
          totalApiCalls: this.ai.getCallCount(),
          totalTokensUsed: this.ai.getTotalTokensUsed(),
        });
      }

      // ══════════ Phase 3: Finalize ══════════
      if (!bestEverPrompt && population.length > 0) {
        population.sort((a, b) => (b.fitness ?? 0) - (a.fitness ?? 0));
        bestEverPrompt = population[0];
      }

      const seedBestFitness = fitnessHistory.length > 0 ? fitnessHistory[0].bestFitness : 0;
      const finalBestFitness = bestEverPrompt?.fitness ?? 0;
      const totalDurationMs = Date.now() - startTime;

      const runSummary: RunSummary = {
        totalGenerations: fitnessHistory.length,
        totalApiCalls: this.ai.getCallCount(),
        totalTokensUsed: this.ai.getTotalTokensUsed(),
        totalDurationMs,
        bestPrompt: bestEverPrompt!,
        seedBestFitness,
        finalBestFitness,
        improvementPercent:
          seedBestFitness > 0
            ? ((finalBestFitness - seedBestFitness) / seedBestFitness) * 100
            : 0,
        convergenceGeneration: findConvergenceGeneration(fitnessHistory),
        fitnessHistory: fitnessHistory.map((s) => ({
          generation: s.generation,
          best: s.bestFitness,
          mean: s.meanFitness,
          worst: s.worstFitness,
        })),
      };

      queries.updateRunProgress(runId, {
        status: "completed",
        completedAt: new Date().toISOString(),
        bestFitness: finalBestFitness,
        bestPromptId: bestEverPrompt?.id ?? undefined,
        totalApiCalls: this.ai.getCallCount(),
        totalTokensUsed: this.ai.getTotalTokensUsed(),
        currentGeneration: fitnessHistory.length,
      });

      this.emit({ type: "run:completed", summary: runSummary });
      return runSummary;
    } catch (error) {
      // If aborted, treat as user-stopped, not an error
      if (this.aborted) {
        this.emit({ type: "run:stopped", reason: "user-stopped" });
        queries.updateRunProgress(runId, {
          status: "stopped",
          stoppedReason: "user-stopped",
          completedAt: new Date().toISOString(),
          totalApiCalls: this.ai.getCallCount(),
          totalTokensUsed: this.ai.getTotalTokensUsed(),
        });
        return {
          totalGenerations: 0,
          totalApiCalls: this.ai.getCallCount(),
          totalTokensUsed: this.ai.getTotalTokensUsed(),
          totalDurationMs: Date.now() - startTime,
          bestPrompt: { id: "", runId, generation: 0, text: "", fitness: null, parentIds: [], origin: { type: "seed", source: "user" }, metadata: null },
          seedBestFitness: 0,
          finalBestFitness: 0,
          improvementPercent: 0,
          convergenceGeneration: null,
          fitnessHistory: [],
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      this.emit({ type: "run:error", error: message });

      queries.updateRunProgress(runId, {
        status: "failed",
        error: message,
        completedAt: new Date().toISOString(),
        totalApiCalls: this.ai.getCallCount(),
        totalTokensUsed: this.ai.getTotalTokensUsed(),
      });

      throw new EvolutionError(`Evolution failed: ${message}`, error instanceof Error ? error : null);
    }
  }

  private async createNextGeneration(
    population: Prompt[],
    runId: string,
    taskDescription: string,
    currentGen: number,
    mutationRate?: number,
  ): Promise<Prompt[]> {
    const nextGen: Prompt[] = [];

    // Elitism: carry over top K
    const elites = selectElites(population, this.config.eliteCount);
    for (const elite of elites) {
      const row = queries.createPrompt({
        runId,
        generation: currentGen,
        text: elite.text,
        fitness: elite.fitness ?? undefined,
        origin: { type: "elite", originalId: elite.id },
        parentIds: [elite.id],
        metadata: elite.metadata ?? undefined,
      });
      nextGen.push(toPrompt(row));
    }

    // Fill remaining slots — create offspring in parallel
    // GemmaClient's semaphore controls actual parallelism
    const remaining = this.config.populationSize - this.config.eliteCount;

    // Pre-compute parent selections and mutation types (sync operations)
    const effectiveMutationRate = mutationRate ?? this.config.mutationRate;
    const offspringPlans = Array.from({ length: remaining }, () => {
      const doCrossover = Math.random() > effectiveMutationRate;
      if (doCrossover) {
        const [parent1, parent2] = tournamentSelect(population, 2);
        return { type: "crossover" as const, parent1, parent2 };
      } else {
        const [parent] = tournamentSelect(population, 1);
        const mutationType = selectMutationType(this.config.mutationStrategies);
        return { type: "mutation" as const, parent, mutationType };
      }
    });

    const offspringResults = await Promise.allSettled(
      offspringPlans.map(async (plan) => {
        if (this.aborted) return null;

        if (plan.type === "crossover") {
          const childText = await performCrossover(
            this.ai,
            taskDescription,
            plan.parent1,
            plan.parent2,
            this.config.crossoverStrategy,
            population,
          );

          const row = queries.createPrompt({
            runId,
            generation: currentGen,
            text: childText,
            origin: {
              type: "crossover",
              parents: [plan.parent1.id, plan.parent2.id],
              strategy: this.config.crossoverStrategy,
            },
            parentIds: [plan.parent1.id, plan.parent2.id],
          });
          const prompt = toPrompt(row);

          this.emit({
            type: "offspring:created",
            generation: currentGen,
            prompt,
          });

          return prompt;
        } else {
          const mutatedText = await performMutation(
            this.ai,
            taskDescription,
            plan.parent,
            plan.mutationType,
          );

          const row = queries.createPrompt({
            runId,
            generation: currentGen,
            text: mutatedText,
            origin: {
              type: "mutation",
              parent: plan.parent.id,
              mutationType: plan.mutationType,
            },
            parentIds: [plan.parent.id],
          });
          const prompt = toPrompt(row);

          this.emit({
            type: "offspring:created",
            generation: currentGen,
            prompt,
          });

          return prompt;
        }
      }),
    );

    for (const outcome of offspringResults) {
      if (outcome.status === "fulfilled" && outcome.value) {
        nextGen.push(outcome.value);
      }
    }

    while (nextGen.length < this.config.populationSize) {
      const fallbackParent = population[nextGen.length % population.length];
      const row = queries.createPrompt({
        runId,
        generation: currentGen,
        text: fallbackParent.text,
        fitness: fallbackParent.fitness ?? undefined,
        origin: { type: "elite", originalId: fallbackParent.id },
        parentIds: [fallbackParent.id],
        metadata: fallbackParent.metadata ?? undefined,
      });
      nextGen.push(toPrompt(row));
    }

    return nextGen;
  }

  private emit(event: EvolutionEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Don't let listener errors crash the engine
      }
    }
  }
}

function computeGenerationSummary(
  population: Prompt[],
  generation: number,
  startTime: number,
): GenerationSummary {
  if (population.length === 0) {
    // Fallback for empty population — should not happen in normal flow
    const placeholder: Prompt = {
      id: "empty",
      runId: "",
      generation,
      text: "(no prompts in population)",
      fitness: 0,
      parentIds: [],
      origin: { type: "seed", source: "generated" },
      metadata: null,
    };
    return {
      generation,
      bestFitness: 0,
      meanFitness: 0,
      worstFitness: 0,
      bestPrompt: placeholder,
      populationSize: 0,
      apiCallsThisGen: 0,
      durationMs: Date.now() - startTime,
    };
  }

  const fitnesses = population
    .map((p) => p.fitness ?? 0)
    .sort((a, b) => b - a);

  return {
    generation,
    bestFitness: fitnesses[0] ?? 0,
    meanFitness: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
    worstFitness: fitnesses[fitnesses.length - 1] ?? 0,
    bestPrompt: population[0],
    populationSize: population.length,
    apiCallsThisGen: 0,
    durationMs: Date.now() - startTime,
  };
}

function findConvergenceGeneration(history: GenerationSummary[]): number | null {
  if (history.length < 2) return null;

  let bestSoFar = history[0].bestFitness;
  for (let i = 1; i < history.length; i++) {
    if (history[i].bestFitness > bestSoFar) {
      bestSoFar = history[i].bestFitness;
    } else if (i === history.length - 1) {
      // Last generation with no improvement = convergence
      return history[i - 1].generation;
    }
  }
  return null;
}

function promptFailureFallback(
  prompt: Prompt,
  metadata: Prompt["metadata"],
): void {
  prompt.fitness = 0;
  prompt.metadata = metadata;

  queries.updatePromptFitness(prompt.id, 0, {
    scoresPerTestCase: metadata?.scoresPerTestCase ?? {},
    avgLatencyMs: metadata?.avgLatencyMs ?? 0,
    totalTokens: metadata?.totalTokens ?? 0,
    judgeReasonings: metadata?.judgeReasonings ?? {},
  });
}

function toPrompt(row: ReturnType<typeof queries.createPrompt>): Prompt {
  return {
    id: row.id,
    runId: row.runId,
    generation: row.generation,
    text: row.text,
    fitness: row.fitness ?? null,
    parentIds: (row.parentIds ?? []) as string[],
    origin: row.origin as Prompt["origin"],
    metadata: (row.metadata ?? null) as Prompt["metadata"],
  };
}
