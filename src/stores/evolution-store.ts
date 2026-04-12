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
  userPrompt: string | null;
  taskDescription: string | null;
  loadState: "idle" | "loading" | "ready" | "not-found" | "error";
  connectionStatus: "idle" | "connecting" | "live" | "disconnected";

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
  setRunMeta: (meta: { userPrompt?: string | null; taskDescription?: string | null }) => void;
  setLoadState: (state: EvolutionState["loadState"]) => void;
  setConnectionStatus: (status: EvolutionState["connectionStatus"]) => void;
  processEvent: (event: EvolutionEvent) => void;
  reset: () => void;
}

const TERMINAL_STATUSES = new Set<RunStatus>([
  "completed",
  "stopped",
  "failed",
]);

const initialState: EvolutionState = {
  runId: null,
  status: "pending",
  stopReason: null,
  errorMessage: null,
  userPrompt: null,
  taskDescription: null,
  loadState: "idle",
  connectionStatus: "idle",
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

    setRunId: (id) =>
      set({
        runId: id,
        status: "pending",
        loadState: "loading",
        connectionStatus: "connecting",
      }),

    setRunMeta: (meta) => set({
      userPrompt: meta.userPrompt ?? null,
      taskDescription: meta.taskDescription ?? null,
    }),

    setLoadState: (loadState) => set({ loadState }),

    setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

    processEvent: (event) =>
      set((state) => {
        const events = [...state.events, event];

        switch (event.type) {
          case "run:started":
            return {
              ...state,
              events,
              status: state.status === "pending" ? "initializing" : state.status,
              runId: event.runId,
              connectionStatus: TERMINAL_STATUSES.has(state.status)
                ? state.connectionStatus
                : "live",
            };

          case "generation:started":
            return {
              ...state,
              events,
              status: TERMINAL_STATUSES.has(state.status) ? state.status : "running",
              currentGeneration: Math.max(state.currentGeneration, event.generation),
              totalGenerations: Math.max(state.totalGenerations, event.totalGenerations),
              evaluationProgress: null,
            };

          case "evaluation:progress": {
            if (event.generation < state.currentGeneration) {
              return { ...state, events };
            }

            // Skip intermediate progress events to avoid UI flickering
            // during parallel evaluation (many events fire simultaneously)
            const prev = state.evaluationProgress;
            if (prev && event.evaluated < event.total && event.evaluated - prev.evaluated < Math.max(1, Math.floor(event.total / 5))) {
              // Skip unless it's a significant jump (at least 20% of total)
              return { ...state, events };
            }
            return {
              ...state,
              events,
              evaluationProgress: {
                evaluated: event.evaluated,
                total: event.total,
              },
            };
          }

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
              currentGeneration: event.summary.totalGenerations,
              totalGenerations: event.summary.totalGenerations,
              connectionStatus: "idle",
              fitnessHistory:
                event.summary.fitnessHistory.length > 0
                  ? event.summary.fitnessHistory
                  : state.fitnessHistory,
            };

          case "run:stopped":
            return {
              ...state,
              events,
              // Don't downgrade from "completed" to "stopped" — keep completed status
              // but store the stop reason (e.g., fitness-reached, early-convergence)
              status: state.status === "completed" ? "completed" : "stopped",
              stopReason: event.reason,
              connectionStatus: "idle",
            };

          case "run:error":
            return {
              ...state,
              events,
              status: "failed",
              errorMessage: event.error,
              connectionStatus: "idle",
            };

          default:
            return { ...state, events };
        }
      }),

    reset: () => set(initialState),
  }),
);
