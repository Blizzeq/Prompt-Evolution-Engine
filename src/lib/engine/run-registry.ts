import type { EvolutionEvent } from "./types";
import { EvolutionEngine } from "./evolution-loop";

interface RunEntry {
  engine: EvolutionEngine;
  listeners: Set<(event: EvolutionEvent) => void>;
  events: EvolutionEvent[];
  completed: boolean;
}

/**
 * In-memory registry bridging fire-and-forget engine execution
 * with SSE clients. Persists across hot reloads via globalThis.
 */
const globalRegistry = globalThis as unknown as {
  __runRegistry?: Map<string, RunEntry>;
};

function getRegistry(): Map<string, RunEntry> {
  if (!globalRegistry.__runRegistry) {
    globalRegistry.__runRegistry = new Map();
  }
  return globalRegistry.__runRegistry;
}

export function registerRun(runId: string, engine: EvolutionEngine): void {
  const entry: RunEntry = {
    engine,
    listeners: new Set(),
    events: [],
    completed: false,
  };

  // Forward engine events to all SSE listeners and buffer them
  engine.onEvent((event) => {
    entry.events.push(event);

    for (const listener of entry.listeners) {
      try {
        listener(event);
      } catch {
        entry.listeners.delete(listener);
      }
    }

    // Mark completed on terminal events
    if (
      event.type === "run:completed" ||
      event.type === "run:stopped" ||
      event.type === "run:error"
    ) {
      entry.completed = true;

      // Clean up after a delay to allow final SSE delivery
      setTimeout(() => {
        getRegistry().delete(runId);
      }, 60_000);
    }
  });

  getRegistry().set(runId, entry);
}

export function getRunEntry(runId: string): RunEntry | undefined {
  return getRegistry().get(runId);
}

/**
 * Subscribe to events for a run. Returns past events (for replay)
 * and registers the listener for future events.
 */
export function subscribeToRun(
  runId: string,
  listener: (event: EvolutionEvent) => void,
): { pastEvents: EvolutionEvent[]; unsubscribe: () => void } {
  const entry = getRegistry().get(runId);
  if (!entry) {
    return { pastEvents: [], unsubscribe: () => {} };
  }

  entry.listeners.add(listener);

  return {
    pastEvents: [...entry.events],
    unsubscribe: () => {
      entry.listeners.delete(listener);
    },
  };
}

/**
 * Stop a running evolution.
 */
export function stopRun(runId: string): boolean {
  const entry = getRegistry().get(runId);
  if (!entry) return false;

  entry.engine.stop();
  return true;
}

/**
 * Check if a run is still active in the registry.
 */
export function isRunActive(runId: string): boolean {
  const entry = getRegistry().get(runId);
  return entry !== undefined && !entry.completed;
}
