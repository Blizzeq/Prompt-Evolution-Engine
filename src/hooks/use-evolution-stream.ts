"use client";

import { useEffect, useRef } from "react";
import { useEvolutionStore } from "@/stores/evolution-store";
import type {
  EvolutionEvent,
  GenerationSummary,
  Prompt,
  RunStatus,
  RunSummary,
  StopReason,
} from "@/lib/engine/types";
import { parseDbDate } from "@/lib/utils/dates";

const TERMINAL_STATES = new Set<RunStatus>(["completed", "stopped", "failed"]);
const MAX_RECONNECT_ATTEMPTS = 10;
const SNAPSHOT_POLL_INTERVAL_MS = 1_000;

interface RunSnapshot {
  run: {
    id: string;
    taskDescription: string;
    userPrompt: string | null;
    config: {
      generations?: number;
      populationSize?: number;
    };
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
  };
  prompts: Prompt[];
  generationSummaries: GenerationSummary[];
}

function isTerminalStatus(status: RunStatus): boolean {
  return TERMINAL_STATES.has(status);
}

function buildRunSummary(snapshot: RunSnapshot, bestPrompt: Prompt | null): RunSummary | null {
  const { run, generationSummaries } = snapshot;
  if (!isTerminalStatus(run.status) || generationSummaries.length === 0 || !bestPrompt) {
    return null;
  }

  const fitnessHistory = generationSummaries.map((summary) => ({
    generation: summary.generation,
    best: summary.bestFitness,
    mean: summary.meanFitness,
    worst: summary.worstFitness,
  }));
  const seedSummary = generationSummaries[0];
  const totalGenerations = Math.max(
    run.currentGeneration ?? generationSummaries.length,
    generationSummaries.length,
  );

  return {
    totalGenerations,
    totalApiCalls: run.totalApiCalls ?? 0,
    totalTokensUsed: run.totalTokensUsed ?? 0,
    totalDurationMs:
      run.completedAt && run.startedAt
        ? parseDbDate(run.completedAt) - parseDbDate(run.startedAt)
        : 0,
    bestPrompt,
    seedBestFitness: seedSummary?.bestFitness ?? 0,
    finalBestFitness: run.bestFitness ?? bestPrompt.fitness ?? 0,
    improvementPercent: seedSummary
      ? ((run.bestFitness ?? bestPrompt.fitness ?? 0) - seedSummary.bestFitness) /
        Math.max(seedSummary.bestFitness, 0.001) * 100
      : 0,
    convergenceGeneration: null,
    fitnessHistory,
  };
}

function syncStoreFromSnapshot(snapshot: RunSnapshot): void {
  const { run, prompts, generationSummaries } = snapshot;
  const currentState = useEvolutionStore.getState();
  const totalGenerations =
    run.config?.generations ??
    currentState.totalGenerations ??
    generationSummaries.length;
  const activePromptGeneration = Math.max(0, run.currentGeneration ?? 0);
  const promptsInActiveGeneration = prompts.filter(
    (prompt) => prompt.generation === activePromptGeneration,
  );
  const evaluatedPrompts = promptsInActiveGeneration.filter(
    (prompt) => prompt.fitness !== null,
  ).length;
  const bestPrompt =
    prompts.find((prompt) => prompt.id === run.bestPromptId) ??
    prompts.reduce<Prompt | null>((best, prompt) => {
      if (prompt.fitness === null) {
        return best;
      }

      if (!best || (prompt.fitness ?? 0) > (best.fitness ?? 0)) {
        return prompt;
      }

      return best;
    }, null) ??
    generationSummaries[generationSummaries.length - 1]?.bestPrompt ??
    currentState.bestPrompt;
  const currentGeneration = isTerminalStatus(run.status)
    ? Math.max(run.currentGeneration ?? generationSummaries.length, generationSummaries.length)
    : Math.min(Math.max(1, (run.currentGeneration ?? 0) + 1), Math.max(totalGenerations, 1));
  const evaluationProgress = isTerminalStatus(run.status)
    ? null
    : {
        evaluated: evaluatedPrompts,
        total:
          run.config?.populationSize ??
          promptsInActiveGeneration.length ??
          currentState.evaluationProgress?.total ??
          0,
      };
  const normalizedEvaluationProgress =
    evaluationProgress && evaluationProgress.total > 0 ? evaluationProgress : null;
  const fitnessHistory = generationSummaries.map((summary) => ({
    generation: summary.generation,
    best: summary.bestFitness,
    mean: summary.meanFitness,
    worst: summary.worstFitness,
  }));
  const summary = buildRunSummary(snapshot, bestPrompt ?? null);

  useEvolutionStore.setState({
    runId: run.id,
    status: run.status,
    stopReason: run.stoppedReason ?? null,
    errorMessage: run.error ?? null,
    userPrompt: run.userPrompt ?? null,
    taskDescription: run.taskDescription ?? null,
    loadState: "ready",
    currentGeneration,
    totalGenerations,
    evaluationProgress: normalizedEvaluationProgress,
    fitnessHistory,
    generationSummaries,
    bestPrompt: bestPrompt ?? null,
    population: promptsInActiveGeneration,
    summary,
    connectionStatus: isTerminalStatus(run.status)
      ? "idle"
      : currentState.connectionStatus,
  });
}

/**
 * Connect to SSE stream for an evolution run and dispatch events to Zustand.
 * Server sends `retry: 3000` to control reconnect interval.
 * Gives up after MAX_RECONNECT_ATTEMPTS consecutive errors.
 */
export function useEvolutionStream(runId: string | null) {
  const processEvent = useEvolutionStore((s) => s.processEvent);
  const status = useEvolutionStore((s) => s.status);
  const setConnectionStatus = useEvolutionStore((s) => s.setConnectionStatus);
  const eventSourceRef = useRef<EventSource | null>(null);
  const errorCountRef = useRef(0);

  useEffect(() => {
    if (!runId) return;

    // Don't connect if run is already in terminal state
    if (isTerminalStatus(useEvolutionStore.getState().status)) return;

    const url = `/api/evolution/${runId}/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    errorCountRef.current = 0;
    setConnectionStatus("connecting");

    es.onopen = () => {
      errorCountRef.current = 0;
      setConnectionStatus("live");
    };

    es.onmessage = (event) => {
      try {
        const parsed: EvolutionEvent = JSON.parse(event.data);
        processEvent(parsed);
        setConnectionStatus("live");

        // Reset error count on successful message
        errorCountRef.current = 0;

        // Close connection on terminal events
        if (
          parsed.type === "run:completed" ||
          parsed.type === "run:stopped" ||
          parsed.type === "run:error"
        ) {
          es.close();
          eventSourceRef.current = null;
          setConnectionStatus("idle");
        }
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      const currentStatus = useEvolutionStore.getState().status;

      // Close on terminal status
      if (TERMINAL_STATES.has(currentStatus)) {
        es.close();
        eventSourceRef.current = null;
        setConnectionStatus("idle");
        return;
      }

      // Give up after too many consecutive errors (prevents infinite reconnect)
      errorCountRef.current++;
      if (errorCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.warn(`[SSE] Giving up after ${MAX_RECONNECT_ATTEMPTS} reconnect attempts`);
        es.close();
        eventSourceRef.current = null;
        setConnectionStatus("disconnected");
      }
      // Otherwise let EventSource auto-reconnect (server sends retry: 3000)
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [runId, processEvent, setConnectionStatus]);

  useEffect(() => {
    if (!isTerminalStatus(status)) return;

    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setConnectionStatus("idle");
  }, [setConnectionStatus, status]);
}

/**
 * Fetch initial run data from the REST API (for page load / reconnection).
 */
export function useRunData(runId: string | null) {
  const setRunId = useEvolutionStore((s) => s.setRunId);
  const setLoadState = useEvolutionStore((s) => s.setLoadState);

  useEffect(() => {
    if (!runId) return;
    setRunId(runId);
    setLoadState("loading");

    let cancelled = false;
    let timer: number | null = null;

    const fetchSnapshot = async () => {
      try {
        const response = await fetch(`/api/evolution/${runId}`);
        if (!response.ok) {
          throw new Error(response.status === 404 ? "not-found" : "load-error");
        }

        const data = (await response.json()) as RunSnapshot;
        if (cancelled) {
          return;
        }

        syncStoreFromSnapshot(data);

        if (!isTerminalStatus(data.run.status)) {
          timer = window.setTimeout(fetchSnapshot, SNAPSHOT_POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "load-error";
        setLoadState(message === "not-found" ? "not-found" : "error");

        if (!isTerminalStatus(useEvolutionStore.getState().status)) {
          timer = window.setTimeout(fetchSnapshot, SNAPSHOT_POLL_INTERVAL_MS);
        }
      }
    };

    void fetchSnapshot();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [runId, setLoadState, setRunId]);
}
