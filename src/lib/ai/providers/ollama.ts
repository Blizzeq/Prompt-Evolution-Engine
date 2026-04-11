import type { AiClientConfig, GenerateOptions, GenerateResult } from "../client";
import { AiClientError } from "@/lib/utils/errors";
import type { OllamaComputeMode } from "@/lib/engine/types";

/** Convert compute mode + layer count to Ollama's num_gpu parameter */
function resolveNumGpu(
  mode: OllamaComputeMode | undefined,
  customLayers: number | undefined,
): number | undefined {
  switch (mode) {
    case "gpu":
      return -1; // all layers on GPU
    case "cpu":
      return 0; // no GPU layers
    case "hybrid":
      return customLayers ?? 20; // user-defined split
    case "auto":
    default:
      return undefined; // let Ollama decide
  }
}

export async function callOllama(
  config: AiClientConfig,
  options: GenerateOptions,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  const start = Date.now();

  const numGpu = resolveNumGpu(config.ollamaComputeMode, config.ollamaNumGpuLayers);

  const response = await fetch(`${config.ollamaBaseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model: config.modelId,
      prompt: options.prompt,
      system: options.systemPrompt,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 1024,
        ...(numGpu !== undefined ? { num_gpu: numGpu } : {}),
      },
      ...(options.jsonMode ? { format: "json" } : {}),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new AiClientError(`Ollama error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  return {
    text: data.response ?? "",
    tokensUsed: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
    latencyMs: Date.now() - start,
    provider: "ollama",
  };
}

export async function checkOllamaHealth(baseUrl: string): Promise<{
  running: boolean;
  models: string[];
}> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) return { running: false, models: [] };
    const data = await response.json();
    const models = (data.models ?? []).map((m: { name: string }) => m.name);
    return { running: true, models };
  } catch {
    return { running: false, models: [] };
  }
}
