import { create } from "zustand";
import type {
  EvolutionEvent,
  GenerationSummary,
  Prompt,
  RunStatus,
  RunSummary,
  StopReason,
} from "@/lib/engine/types";

interface FitnessPoint {
  generation: number;
  best: number;
  mean: number;
  worst: number;
}

interface EvolutionState {
  // Run metadata
  runId: string | null;
  status: RunStatus;
  stopReason: StopReason | null;
  errorMessage: string | null;

  // Progress
  currentGeneration: number;
  totalGenerations: number;
  evaluationProgress: { evaluated: number; total: number } | null;

  // Data
  fitnessHistory: FitnessPoint[];
  generationSummaries: GenerationSummary[];
  bestPrompt: Prompt | null;
  population: Prompt[];

  // Final results
  summary: RunSummary | null;

  // Event log
  events: EvolutionEvent[];
}

interface EvolutionActions {
  setRunId: (id: string) => void;
  processEvent: (event: EvolutionEvent) => void;
  reset: () => void;
}

const initialState: EvolutionState = {
  runId: null,
  status: "pending",
  stopReason: null,
  errorMessage: null,
  currentGeneration: 0,
  totalGenerations: 0,
  evaluationProgress: null,
  fitnessHistory: [],
  generationSummaries: [],
  bestPrompt: null,
  population: [],
  summary: null,
  events: [],
};

export const useEvolutionStore = create<EvolutionState & EvolutionActions>()(
  (set) => ({
    ...initialState,

    setRunId: (id) => set({ runId: id, status: "pending" }),

    processEvent: (event) =>
      set((state) => {
        const events = [...state.events, event];

        switch (event.type) {
          case "run:started":
            return { ...state, events, status: "initializing", runId: event.runId };

          case "generation:started":
            return {
              ...state,
              events,
              status: "running",
              currentGeneration: event.generation,
              totalGenerations: event.totalGenerations,
              evaluationProgress: null,
            };

          case "evaluation:progress":
            return {
              ...state,
              events,
              evaluationProgress: {
                evaluated: event.evaluated,
                total: event.total,
              },
            };

          case "generation:complete": {
            const summary = event.summary;
            const fitnessPoint: FitnessPoint = {
              generation: summary.generation,
              best: summary.bestFitness,
              mean: summary.meanFitness,
              worst: summary.worstFitness,
            };

            const bestPrompt =
              !state.bestPrompt ||
              (summary.bestPrompt.fitness ?? 0) > (state.bestPrompt.fitness ?? 0)
                ? summary.bestPrompt
                : state.bestPrompt;

            // Deduplicate by generation number (in case of replayed events)
            const existingIdx = state.generationSummaries.findIndex(
              (s) => s.generation === summary.generation,
            );
            const updatedSummaries =
              existingIdx >= 0
                ? state.generationSummaries.map((s, i) => (i === existingIdx ? summary : s))
                : [...state.generationSummaries, summary];

            const existingFitnessIdx = state.fitnessHistory.findIndex(
              (f) => f.generation === fitnessPoint.generation,
            );
            const updatedFitness =
              existingFitnessIdx >= 0
                ? state.fitnessHistory.map((f, i) => (i === existingFitnessIdx ? fitnessPoint : f))
                : [...state.fitnessHistory, fitnessPoint];

            return {
              ...state,
              events,
              fitnessHistory: updatedFitness,
              generationSummaries: updatedSummaries,
              bestPrompt,
              evaluationProgress: null,
            };
          }

          case "offspring:created":
            return {
              ...state,
              events,
              population: [...state.population, event.prompt],
            };

          case "run:completed":
            return {
              ...state,
              events,
              status: "completed",
              summary: event.summary,
              bestPrompt: event.summary.bestPrompt,
              fitnessHistory:
                event.summary.fitnessHistory.length > 0
                  ? event.summary.fitnessHistory
                  : state.fitnessHistory,
            };

          case "run:stopped":
            return {
              ...state,
              events,
              status: "stopped",
              stopReason: event.reason,
            };

          case "run:error":
            return {
              ...state,
              events,
              status: "failed",
              errorMessage: event.error,
            };

          default:
            return { ...state, events };
        }
      }),

    reset: () => set(initialState),
  }),
);
