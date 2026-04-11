import type { AiClientConfig, GenerateOptions, GenerateResult } from "../client";
import { AiClientError } from "@/lib/utils/errors";

export async function callOpenRouter(
  config: AiClientConfig,
  options: GenerateOptions,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  const start = Date.now();

  const messages: { role: string; content: string }[] = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: options.prompt });

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: `google/${config.modelId}:free`,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    throw new AiClientError(`OpenRouter error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return {
    text: data.choices[0]?.message?.content ?? "",
    tokensUsed: data.usage?.total_tokens ?? 0,
    latencyMs: Date.now() - start,
    provider: "openrouter",
  };
}

export async function checkOpenRouterHealth(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}
