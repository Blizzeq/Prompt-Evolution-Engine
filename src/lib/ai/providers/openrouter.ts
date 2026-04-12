import type { AiClientConfig, GenerateOptions, GenerateResult } from "../client";
import { AiClientError, PermanentRateLimitError } from "@/lib/utils/errors";

/** Patterns in 429 error messages that indicate a permanent daily/monthly cap */
const PERMANENT_RATE_LIMIT_PATTERNS = [
  "free-models-per-day",
  "free-models-per-month",
  "daily-limit",
  "monthly-limit",
  "credits to unlock",
];

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

  // Use model ID as-is (user selects full OpenRouter model ID like "google/gemini-2.5-flash")
  const modelId = config.modelId;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: modelId,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");

    // Distinguish permanent rate limits (daily cap) from temporary ones
    if (response.status === 429) {
      const isPermanent = PERMANENT_RATE_LIMIT_PATTERNS.some(
        (pattern) => errorText.toLowerCase().includes(pattern),
      );

      if (isPermanent) {
        // Parse reset timestamp if available
        const resetHeader = response.headers.get("X-RateLimit-Reset");
        const resetTs = resetHeader ? parseInt(resetHeader, 10) : undefined;

        throw new PermanentRateLimitError(
          `OpenRouter daily limit reached. Free tier allows ~50 requests/day. Add credits at openrouter.ai or switch to Google AI Studio (free, 1500 req/day). Raw: ${errorText}`,
          resetTs,
        );
      }
    }

    throw new AiClientError(`OpenRouter error: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  // Defensive: check the response structure
  const text = data?.choices?.[0]?.message?.content ?? "";

  if (!text && data?.error) {
    throw new AiClientError(
      `OpenRouter API error: ${data.error.message ?? JSON.stringify(data.error)}`,
    );
  }

  return {
    text,
    tokensUsed: data?.usage?.total_tokens ?? 0,
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
