import { NextResponse } from "next/server";
import { MODEL_PRESETS } from "@/lib/engine/types";
import { listGoogleAIModels } from "@/lib/ai/providers/google-ai";
import {
  enforceRouteRateLimit,
  normalizeOllamaBaseUrl,
  requireTrustedLocalRequest,
} from "@/lib/utils/request-security";

export const dynamic = "force-dynamic";

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing?: { prompt: string; completion: string };
  context_length?: number;
}

export async function POST(request: Request) {
  const accessError = requireTrustedLocalRequest(request, "Model discovery");
  if (accessError) {
    return accessError;
  }

  const rateLimitError = enforceRouteRateLimit(request, "models", {
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimitError) {
    return rateLimitError;
  }

  const body = await request.json().catch(() => ({}));
  const provider = body.provider ?? "ollama";

  try {
    if (provider === "ollama") {
      const baseUrl = normalizeOllamaBaseUrl(
        body.baseUrl ?? "http://localhost:11434",
      );
      return await getOllamaModels(baseUrl);
    }

    if (provider === "google-ai-studio") {
      const apiKey = body.apiKey ?? "";
      if (apiKey) {
        // Fetch live model list from Google AI
        const liveModels = await listGoogleAIModels(apiKey);
        if (liveModels.length > 0) {
          return NextResponse.json({
            models: liveModels.map((m) => ({
              id: m.id,
              name: m.name,
              description: m.description,
              free: true, // Google AI Studio is free tier
            })),
            source: "google-ai-live",
          });
        }
      }
      // Fallback to curated presets if no key or API failed
      return NextResponse.json({
        models: MODEL_PRESETS["google-ai-studio"].map((m) => ({
          id: m.id,
          name: m.label,
          description: m.description,
          free: true,
        })),
        source: "presets",
      });
    }

    if (provider === "openrouter") {
      const apiKey = body.apiKey ?? "";
      return await getOpenRouterModels(apiKey);
    }

    return NextResponse.json({ models: [], source: "unknown" });
  } catch (error) {
    console.error("[Models API] Error:", error);
    // Fallback to presets
    const presets = MODEL_PRESETS[provider as keyof typeof MODEL_PRESETS] ?? [];
    return NextResponse.json({
      models: presets.map((m) => ({
        id: m.id,
        name: m.label,
        description: m.description,
      })),
      source: "presets-fallback",
    });
  }
}

async function getOllamaModels(baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error("Ollama not reachable");
    const data = await res.json();

    const models = (data.models ?? []).map((m: { name: string; size: number; modified_at: string }) => ({
      id: m.name.replace(":latest", ""),
      name: m.name,
      description: `${(m.size / 1e9).toFixed(1)} GB`,
      installed: true,
    }));

    // Also include presets for models not yet installed
    const installedIds = new Set(models.map((m: { id: string }) => m.id));
    const suggestions = MODEL_PRESETS.ollama
      .filter((p) => !installedIds.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.label,
        description: `${p.description} (not installed)`,
        installed: false,
      }));

    return NextResponse.json({
      models: [...models, ...suggestions],
      source: "ollama-live",
    });
  } catch {
    return NextResponse.json({
      models: MODEL_PRESETS.ollama.map((m) => ({
        id: m.id,
        name: m.label,
        description: m.description,
        installed: false,
      })),
      source: "presets-fallback",
    });
  }
}

async function getOpenRouterModels(apiKey: string) {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error("OpenRouter API error");
    const data = await res.json();

    // Filter to text generation models, sort by free first and popularity
    const models = (data.data ?? [])
      .filter((m: OpenRouterModel) => {
        // Only include models that work for text generation
        return m.id && m.name;
      })
      .map((m: OpenRouterModel) => {
        const isFree =
          m.pricing?.prompt === "0" || m.pricing?.prompt === "0.00000000";
        return {
          id: m.id,
          name: m.name,
          description: isFree ? "Free" : `Paid`,
          free: isFree,
          contextLength: m.context_length,
        };
      })
      // Show free models first, then sort by name
      .sort(
        (a: { free: boolean; name: string }, b: { free: boolean; name: string }) => {
          if (a.free && !b.free) return -1;
          if (!a.free && b.free) return 1;
          return a.name.localeCompare(b.name);
        },
      )
      // Limit to prevent huge lists
      .slice(0, 100);

    return NextResponse.json({
      models,
      source: "openrouter-live",
      total: (data.data ?? []).length,
    });
  } catch {
    return NextResponse.json({
      models: MODEL_PRESETS.openrouter.map((m) => ({
        id: m.id,
        name: m.label,
        description: m.description,
        free: true,
      })),
      source: "presets-fallback",
    });
  }
}
