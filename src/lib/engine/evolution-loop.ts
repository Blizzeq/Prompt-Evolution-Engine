import type {
  EvolutionConfig,
  EvolutionEvent,
  GenerationSummary,
  Prompt,
  RunSummary,
  StopReason,
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

      for (let gen = 1; gen <= this.config.generations; gen++) {
        if (this.aborted) {
          this.emit({ type: "run:stopped", reason: "user-stopped" });
          queries.updateRunProgress(runId, {
            status: "stopped",
            stoppedReason: "user-stopped",
            completedAt: new Date().toISOString(),
          });
          break;
        }

        const genStartTime = Date.now();

        this.emit({
          type: "generation:started",
          generation: gen,
          totalGenerations: this.config.generations,
        });

        // ── Step 1: Evaluate fitness ──
        const unevaluated = population.filter((p) => p.fitness === null);
        let evaluated = 0;

        for (const prompt of unevaluated) {
          if (this.aborted) break;

          const result = await evaluatePrompt(
            this.ai,
            prompt,
            testCases,
            run.taskDescription,
            this.config.batchTestCases,
          );

          // Update prompt in the population array
          prompt.fitness = result.fitness;
          prompt.metadata = result.metadata;

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

        // ── Step 4: Track best ever ──
        if (!bestEverPrompt || summary.bestFitness > (bestEverPrompt.fitness ?? 0)) {
          bestEverPrompt = { ...summary.bestPrompt };
          noImprovementCount = 0;
        } else {
          noImprovementCount++;
        }

        // ── Step 5: Early stopping ──
        if (noImprovementCount >= this.config.earlyStopGenerations) {
          this.emit({ type: "run:stopped", reason: "early-convergence" });
          queries.updateRunProgress(runId, {
            stoppedReason: "early-convergence",
          });
          break;
        }

        // Fitness threshold reached
        if (summary.bestFitness >= 0.99) {
          this.emit({ type: "run:stopped", reason: "fitness-reached" });
          queries.updateRunProgress(runId, {
            stoppedReason: "fitness-reached",
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
        );

        population = nextGeneration;

        // Save progress to DB
        queries.updateRunProgress(runId, {
          currentGeneration: gen,
          bestFitness: bestEverPrompt?.fitness ?? undefined,
          bestPromptId: bestEverPrompt?.id ?? undefined,
          totalApiCalls: this.ai.getCallCount(),
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
        totalTokensUsed: 0, // TODO: track from AI client
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
        });
        return {
          totalGenerations: 0,
          totalApiCalls: this.ai.getCallCount(),
          totalTokensUsed: 0,
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
      });

      throw new EvolutionError(`Evolution failed: ${message}`, error instanceof Error ? error : null);
    }
  }

  private async createNextGeneration(
    population: Prompt[],
    runId: string,
    taskDescription: string,
    currentGen: number,
  ): Promise<Prompt[]> {
    const nextGen: Prompt[] = [];

    // Elitism: carry over top K
    const elites = selectElites(population, this.config.eliteCount);
    for (const elite of elites) {
      const row = queries.createPrompt({
        runId,
        generation: currentGen + 1,
        text: elite.text,
        fitness: elite.fitness ?? undefined,
        origin: { type: "elite", originalId: elite.id },
        parentIds: [elite.id],
        metadata: elite.metadata ?? undefined,
      });
      nextGen.push(toPrompt(row));
    }

    // Fill remaining slots
    const remaining = this.config.populationSize - this.config.eliteCount;

    for (let i = 0; i < remaining; i++) {
      if (this.aborted) break;

      const doCrossover = Math.random() > this.config.mutationRate;

      if (doCrossover) {
        // Crossover
        const [parent1, parent2] = tournamentSelect(population, 2);

        const childText = await performCrossover(
          this.ai,
          taskDescription,
          parent1,
          parent2,
          this.config.crossoverStrategy,
          population,
        );

        const row = queries.createPrompt({
          runId,
          generation: currentGen + 1,
          text: childText,
          origin: {
            type: "crossover",
            parents: [parent1.id, parent2.id],
            strategy: this.config.crossoverStrategy,
          },
          parentIds: [parent1.id, parent2.id],
        });
        nextGen.push(toPrompt(row));

        this.emit({
          type: "offspring:created",
          generation: currentGen + 1,
          prompt: toPrompt(row),
        });
      } else {
        // Mutation
        const [parent] = tournamentSelect(population, 1);
        const mutationType = selectMutationType(this.config.mutationStrategies);

        const mutatedText = await performMutation(
          this.ai,
          taskDescription,
          parent,
          mutationType,
        );

        const row = queries.createPrompt({
          runId,
          generation: currentGen + 1,
          text: mutatedText,
          origin: {
            type: "mutation",
            parent: parent.id,
            mutationType,
          },
          parentIds: [parent.id],
        });
        nextGen.push(toPrompt(row));

        this.emit({
          type: "offspring:created",
          generation: currentGen + 1,
          prompt: toPrompt(row),
        });
      }
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
