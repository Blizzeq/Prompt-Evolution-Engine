import type { EvolutionEvent } from "@/lib/engine/types";

export function encodeSSE(event: EvolutionEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      controller = null;
    },
  });

  function send(event: EvolutionEvent) {
    if (controller) {
      try {
        controller.enqueue(encoder.encode(encodeSSE(event)));
      } catch {
        // Stream was closed
        controller = null;
      }
    }
  }

  function close() {
    if (controller) {
      try {
        controller.close();
      } catch {
        // Already closed
      }
      controller = null;
    }
  }

  return { stream, send, close };
}

export function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}
