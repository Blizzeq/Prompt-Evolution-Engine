"use client";

import { useEffect, useRef } from "react";
import { useEvolutionStore } from "@/stores/evolution-store";
import type { EvolutionEvent } from "@/lib/engine/types";

/**
 * Connect to SSE stream for an evolution run and dispatch events to Zustand.
 * Automatically reconnects on disconnection. Returns cleanup on unmount.
 */
export function useEvolutionStream(runId: string | null) {
  const processEvent = useEvolutionStore((s) => s.processEvent);
  const status = useEvolutionStore((s) => s.status);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!runId) return;

    // Don't connect if run is already in terminal state
    const terminalStates = ["completed", "stopped", "failed"];
    if (terminalStates.includes(status)) return;

    const url = `/api/evolution/${runId}/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const parsed: EvolutionEvent = JSON.parse(event.data);
        processEvent(parsed);

        // Close connection on terminal events
        if (
          parsed.type === "run:completed" ||
          parsed.type === "run:stopped" ||
          parsed.type === "run:error"
        ) {
          es.close();
          eventSourceRef.current = null;
        }
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects, but close on terminal status
      const currentStatus = useEvolutionStore.getState().status;
      if (terminalStates.includes(currentStatus)) {
        es.close();
        eventSourceRef.current = null;
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [runId, processEvent, status]);
}

/**
 * Fetch initial run data from the REST API (for page load / reconnection).
 */
export function useRunData(runId: string | null) {
  const processEvent = useEvolutionStore((s) => s.processEvent);
  const setRunId = useEvolutionStore((s) => s.setRunId);

  useEffect(() => {
    if (!runId) return;
    setRunId(runId);

    fetch(`/api/evolution/${runId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        const { run, generationSummaries } = data;

        // Synthesize events from DB state for the store
        processEvent({ type: "run:started", runId: run.id });

        for (const summary of generationSummaries) {
          processEvent({
            type: "generation:started",
            generation: summary.generation,
            totalGenerations: run.config?.generations ?? 10,
          });
          processEvent({
            type: "generation:complete",
            generation: summary.generation,
            summary: {
              ...summary,
              apiCallsThisGen: 0,
              durationMs: 0,
            },
          });
        }

        // If run is in terminal state, emit the appropriate event
        if (run.status === "completed" || run.status === "stopped" || run.status === "failed") {
          if (run.status === "failed") {
            processEvent({ type: "run:error", error: run.error ?? "Unknown error" });
          } else if (run.status === "stopped") {
            processEvent({ type: "run:stopped", reason: run.stoppedReason ?? "user-stopped" });
          } else if (run.status === "completed") {
            // Synthesize run:completed from DB state
            const lastSummary = generationSummaries[generationSummaries.length - 1];
            const fitnessHistory = generationSummaries.map((s: { generation: number; bestFitness: number; meanFitness: number; worstFitness: number }) => ({
              generation: s.generation,
              best: s.bestFitness,
              mean: s.meanFitness,
              worst: s.worstFitness,
            }));
            const seedSummary = generationSummaries[0];
            processEvent({
              type: "run:completed",
              summary: {
                totalGenerations: run.currentGeneration + 1,
                totalApiCalls: run.totalApiCalls ?? 0,
                totalTokensUsed: run.totalTokensUsed ?? 0,
                totalDurationMs: run.completedAt && run.startedAt
                  ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
                  : 0,
                bestPrompt: lastSummary?.bestPrompt ?? { id: "", runId: run.id, generation: 0, text: "", fitness: 0, parentIds: [], origin: { type: "seed" as const, source: "generated" as const }, metadata: null },
                seedBestFitness: seedSummary?.bestFitness ?? 0,
                finalBestFitness: run.bestFitness ?? lastSummary?.bestFitness ?? 0,
                improvementPercent: seedSummary
                  ? ((run.bestFitness ?? lastSummary?.bestFitness ?? 0) - seedSummary.bestFitness) / Math.max(seedSummary.bestFitness, 0.001) * 100
                  : 0,
                convergenceGeneration: null,
                fitnessHistory,
              },
            });
          }
        }
      })
      .catch(() => {
        // Run not found — will show error in UI
      });
  }, [runId, processEvent, setRunId]);
}
