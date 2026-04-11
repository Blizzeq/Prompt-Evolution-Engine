import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const model = body.model ?? "gemma4:26b-a4b";
  const baseUrl = body.baseUrl ?? "http://localhost:11434";

  // Check Ollama is running
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error("Ollama not reachable");
  } catch {
    return NextResponse.json(
      { success: false, error: "Ollama is not running" },
      { status: 503 },
    );
  }

  // Check if model already exists
  try {
    const tagsRes = await fetch(`${baseUrl}/api/tags`);
    const tagsData = await tagsRes.json();
    const models: string[] = (tagsData.models ?? []).map(
      (m: { name: string }) => m.name,
    );

    if (models.some((m) => m.includes(model.split(":")[0]))) {
      return NextResponse.json({
        success: true,
        message: `Model ${model} is already available`,
        alreadyExists: true,
      });
    }
  } catch {
    // Continue to pull
  }

  // Stream the pull progress from Ollama back to the client as SSE
  const ollamaRes = await fetch(`${baseUrl}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: model, stream: true }),
  });

  if (!ollamaRes.ok || !ollamaRes.body) {
    return NextResponse.json(
      { success: false, error: "Failed to start model pull" },
      { status: 500 },
    );
  }

  // Transform Ollama's NDJSON stream into SSE
  const reader = ollamaRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ status: "done" })}\n\n`,
            ),
          );
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);

            // Handle Ollama error responses
            if (data.error) {
              const errorMsg = data.error.includes("newer version")
                ? "update-required"
                : data.error;
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ status: "error", error: errorMsg })}\n\n`,
                ),
              );
              controller.close();
              return;
            }

            const event = {
              status: data.status ?? "",
              total: data.total ?? 0,
              completed: data.completed ?? 0,
              digest: data.digest ?? "",
            };
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify(event)}\n\n`,
              ),
            );
          } catch {
            // Skip malformed lines
          }
        }
      } catch {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ status: "error", error: "Stream interrupted" })}\n\n`,
          ),
        );
        controller.close();
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
