import { GoogleGenAI } from "@google/genai";
import type { AiClientConfig, GenerateOptions, GenerateResult } from "../client";
import { AiClientError } from "@/lib/utils/errors";

export function createGoogleClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

export async function callGoogleAI(
  client: GoogleGenAI,
  config: AiClientConfig,
  options: GenerateOptions,
): Promise<GenerateResult> {
  const start = Date.now();

  try {
    const response = await client.models.generateContent({
      model: config.modelId,
      contents: options.prompt,
      config: {
        systemInstruction: options.systemPrompt,
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 1024,
        responseMimeType: options.jsonMode ? "application/json" : undefined,
      },
    });

    return {
      text: response.text ?? "",
      tokensUsed: response.usageMetadata?.totalTokenCount ?? 0,
      latencyMs: Date.now() - start,
      provider: "google-ai-studio",
    };
  } catch (error) {
    throw new AiClientError(
      `Google AI error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function checkGoogleAIHealth(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const client = new GoogleGenAI({ apiKey });
    await client.models.generateContent({
      model: "gemma-3-27b-it",
      contents: "Say 'ok'",
      config: { maxOutputTokens: 5 },
    });
    return true;
  } catch {
    return false;
  }
}
