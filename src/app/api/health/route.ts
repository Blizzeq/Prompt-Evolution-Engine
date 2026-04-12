import { NextResponse } from "next/server";
import { getConfig } from "@/lib/utils/config";
import { checkOllamaHealth } from "@/lib/ai/providers/ollama";
import { checkGoogleAIHealth } from "@/lib/ai/providers/google-ai";
import { checkOpenRouterHealth } from "@/lib/ai/providers/openrouter";
import {
  enforceRouteRateLimit,
  normalizeOllamaBaseUrl,
  requireTrustedLocalRequest,
} from "@/lib/utils/request-security";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getConfig();

  return NextResponse.json({
    status: "ok",
    defaultProvider: config.provider,
    modelId: config.modelId,
    mode: config.allowRemoteAccess ? "remote-enabled" : "local-only",
  });
}

export async function POST(request: Request) {
  const config = getConfig();

  const accessError = requireTrustedLocalRequest(request, "Provider health check");
  if (accessError) {
    return accessError;
  }

  const rateLimitError = enforceRouteRateLimit(request, "health", {
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimitError) {
    return rateLimitError;
  }

  const body = await request.json().catch(() => ({}));
  const provider = body.provider;

  if (provider === "ollama" || (!provider && config.provider === "ollama")) {
    const baseUrl = normalizeOllamaBaseUrl(
      body.baseUrl ?? config.ollamaBaseUrl,
    );
    const modelId = body.modelId ?? config.modelId;
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
    const key = body.apiKey ?? "";
    if (!key) {
      return NextResponse.json(
        {
          provider: "google-ai-studio",
          status: "missing-key",
          valid: false,
        },
        { status: 400 },
      );
    }

    const valid = await checkGoogleAIHealth(key);
    return NextResponse.json({
      provider: "google-ai-studio",
      status: valid ? "ready" : "invalid-key",
      valid,
    });
  }

  if (provider === "openrouter") {
    const key = body.apiKey ?? "";
    if (!key) {
      return NextResponse.json(
        {
          provider: "openrouter",
          status: "missing-key",
          valid: false,
        },
        { status: 400 },
      );
    }

    const valid = await checkOpenRouterHealth(key);
    return NextResponse.json({
      provider: "openrouter",
      status: valid ? "ready" : "invalid-key",
      valid,
    });
  }

  return NextResponse.json({ status: "invalid-provider" }, { status: 400 });
}
