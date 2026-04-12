import { GoogleGenAI } from "@google/genai";
import type { AiClientConfig, GenerateOptions, GenerateResult } from "../client";
import { AiClientError } from "@/lib/utils/errors";

export function createGoogleClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

/** Safely extract text from Google AI response (the .text getter can throw) */
function safeExtractText(response: { text?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }): string {
  // Try the .text getter first (works when candidates exist)
  try {
    if (typeof response.text === "string") {
      return response.text;
    }
  } catch {
    // .text getter threw — fall through to manual extraction
  }

  // Manual extraction from candidates
  try {
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts && parts.length > 0) {
      return parts.map((p) => p.text ?? "").join("");
    }
  } catch {
    // Malformed response
  }

  return "";
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

    const text = safeExtractText(response as never);

    if (!text) {
      throw new AiClientError(
        "Google AI returned empty response (possible safety filter or empty candidates)",
      );
    }

    return {
      text,
      tokensUsed: response.usageMetadata?.totalTokenCount ?? 0,
      latencyMs: Date.now() - start,
      provider: "google-ai-studio",
    };
  } catch (error) {
    if (error instanceof AiClientError) throw error;
    throw new AiClientError(
      `Google AI error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Validate a Google AI API key by listing available models.
 * More reliable than generating content (avoids model-specific issues).
 */
export async function checkGoogleAIHealth(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const client = new GoogleGenAI({ apiKey });
    // List models to validate the key — lightweight, no token usage
    const result = await client.models.list();
    // If we get any result without throwing, the key is valid
    const models = [];
    for await (const model of result) {
      models.push(model);
      break; // Only need one to confirm key works
    }
    return models.length > 0;
  } catch (error) {
    console.error("[Google AI Health] Error:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Fetch available models from Google AI.
 * Returns models that support generateContent (text generation).
 */
export async function listGoogleAIModels(apiKey: string): Promise<Array<{
  id: string;
  name: string;
  description: string;
}>> {
  if (!apiKey) return [];

  try {
    const client = new GoogleGenAI({ apiKey });
    const result = await client.models.list();
    const models: Array<{ id: string; name: string; description: string }> = [];

    for await (const model of result) {
      // Only include models that support generateContent
      const methods = model.supportedActions ?? [];
      if (!methods.includes("generateContent")) continue;

      // Extract short ID (remove "models/" prefix)
      const id = model.name?.replace("models/", "") ?? "";
      if (!id) continue;

      // Skip embedding models
      if (id.includes("embedding") || id.includes("aqa")) continue;

      models.push({
        id,
        name: model.displayName ?? id,
        description: model.description?.slice(0, 100) ?? "",
      });
    }

    // Sort: gemini-2.5 first, then gemini-2.0, then gemma, then rest
    models.sort((a, b) => {
      const priority = (id: string) => {
        if (id.startsWith("gemini-2.5")) return 0;
        if (id.startsWith("gemini-2.0")) return 1;
        if (id.startsWith("gemma")) return 2;
        return 3;
      };
      return priority(a.id) - priority(b.id) || a.id.localeCompare(b.id);
    });

    return models;
  } catch (error) {
    console.error("[Google AI Models] Error fetching models:", error instanceof Error ? error.message : error);
    return [];
  }
}
