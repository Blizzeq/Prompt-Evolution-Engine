import { NextResponse } from "next/server";
import { getConfig } from "@/lib/utils/config";
import { checkOllamaHealth } from "@/lib/ai/providers/ollama";
import { checkGoogleAIHealth } from "@/lib/ai/providers/google-ai";
import { checkOpenRouterHealth } from "@/lib/ai/providers/openrouter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  const apiKey = searchParams.get("apiKey") ?? "";
  const config = getConfig();

  if (provider === "ollama" || (!provider && config.provider === "ollama")) {
    const baseUrl = searchParams.get("baseUrl") ?? config.ollamaBaseUrl;
    const modelId = searchParams.get("modelId") ?? config.modelId;
    const health = await checkOllamaHealth(baseUrl);
    // Check if the selected model (or its base name) is available
    const modelBase = modelId.split(":")[0];
    const hasModel = health.models.some(
      (m) => m === modelId || m.startsWith(modelBase + ":") || m === modelBase,
    );
    return NextResponse.json({
      provider: "ollama",
      status: health.running ? (hasModel ? "ready" : "no-model") : "offline",
      running: health.running,
      models: health.models,
      hasModel,
    });
  }

  if (provider === "google-ai-studio") {
    const key = apiKey || config.googleAiApiKey;
    const valid = await checkGoogleAIHealth(key);
    return NextResponse.json({
      provider: "google-ai-studio",
      status: valid ? "ready" : "invalid-key",
      valid,
    });
  }

  if (provider === "openrouter") {
    const key = apiKey || config.openrouterApiKey;
    const valid = await checkOpenRouterHealth(key);
    return NextResponse.json({
      provider: "openrouter",
      status: valid ? "ready" : "invalid-key",
      valid,
    });
  }

  return NextResponse.json({
    status: "ok",
    defaultProvider: config.provider,
    modelId: config.modelId,
  });
}
