import { subscribeToRun, isRunActive } from "@/lib/engine/run-registry";
import { encodeSSE, sseHeaders } from "@/lib/utils/sse";
import type { EvolutionEvent } from "@/lib/engine/types";
import * as queries from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_WAIT_FOR_RUN_MS = 30_000;
const TERMINAL_STATUSES = new Set(["completed", "stopped", "failed"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = queries.getRun(id);
  if (!run) {
    return new Response(JSON.stringify({ error: "Run not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const abortSignal = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      let unsubscribe: (() => void) | null = null;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let closed = false;

      const cleanup = () => {
        closed = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (unsubscribe) unsubscribe();
      };

      const safeSend = (data: string): boolean => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(data));
          return true;
        } catch {
          cleanup();
          return false;
        }
      };

      // Abort on client disconnect
      abortSignal.addEventListener("abort", () => {
        cleanup();
        try { controller.close(); } catch { /* already closed */ }
      }, { once: true });

      // Start heartbeat to keep connection alive (prevents proxy/browser timeouts)
      heartbeatTimer = setInterval(() => {
        const latestRun = queries.getRun(id);
        if (!latestRun) {
          cleanup();
          try {
            controller.close();
          } catch {
            // already closed
          }
          return;
        }

        if (TERMINAL_STATUSES.has(latestRun.status) && !isRunActive(id)) {
          cleanup();
          try {
            controller.close();
          } catch {
            // already closed
          }
          return;
        }

        if (!safeSend(": heartbeat\n\n")) {
          cleanup();
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Set SSE retry interval to 3 seconds (tells EventSource how long to wait before reconnecting)
      safeSend("retry: 3000\n\n");

      // Wait for run to appear in registry (engine starts in background)
      let sub = subscribeToRun(id, () => {});
      sub.unsubscribe();

      if (sub.pastEvents.length === 0) {
        // Run not registered yet — wait for it (up to 30s)
        const waitStart = Date.now();
        while (Date.now() - waitStart < MAX_WAIT_FOR_RUN_MS && !closed) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          sub = subscribeToRun(id, () => {});
          sub.unsubscribe();
          if (sub.pastEvents.length > 0) break;
          // Send heartbeat while waiting
          if (!safeSend(": waiting\n\n")) break;
        }
      }

      // Subscribe for real now
      const subscription = subscribeToRun(
        id,
        (event: EvolutionEvent) => {
          if (!safeSend(encodeSSE(event))) return;

          // Close stream on terminal events
          if (
            event.type === "run:completed" ||
            event.type === "run:stopped" ||
            event.type === "run:error"
          ) {
            setTimeout(() => {
              cleanup();
              try { controller.close(); } catch { /* already closed */ }
            }, 200);
          }
        },
      );
      unsubscribe = subscription.unsubscribe;

      // Replay past events
      for (const event of subscription.pastEvents) {
        if (!safeSend(encodeSSE(event))) break;
      }

      if (
        subscription.pastEvents.length === 0 &&
        !isRunActive(id) &&
        TERMINAL_STATUSES.has(run.status)
      ) {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      // cleanup handled by abort listener and safeSend failure detection
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
