import { subscribeToRun } from "@/lib/engine/run-registry";
import { encodeSSE, sseHeaders } from "@/lib/utils/sse";
import type { EvolutionEvent } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Subscribe to run events
      const { pastEvents, unsubscribe } = subscribeToRun(
        id,
        (event: EvolutionEvent) => {
          try {
            controller.enqueue(encoder.encode(encodeSSE(event)));

            // Close stream on terminal events
            if (
              event.type === "run:completed" ||
              event.type === "run:stopped" ||
              event.type === "run:error"
            ) {
              setTimeout(() => {
                try {
                  controller.close();
                } catch {
                  // Already closed
                }
              }, 100);
            }
          } catch {
            // Stream closed by client
            unsubscribe();
          }
        },
      );

      // Replay past events for reconnecting clients
      for (const event of pastEvents) {
        try {
          controller.enqueue(encoder.encode(encodeSSE(event)));
        } catch {
          break;
        }
      }

      // If no active run found, send error and close
      if (pastEvents.length === 0) {
        // Check if run exists but engine is not registered
        // (could be a completed run or not yet started)
        const pingEvent: EvolutionEvent = {
          type: "run:started",
          runId: id,
        };
        try {
          controller.enqueue(encoder.encode(encodeSSE(pingEvent)));
        } catch {
          // Stream closed
        }
      }
    },
    cancel() {
      // Client disconnected — unsubscribe handled by listener error
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
