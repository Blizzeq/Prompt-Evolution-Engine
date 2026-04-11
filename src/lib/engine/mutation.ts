import type { MutationType, Prompt } from "./types";
import type { GemmaClient } from "@/lib/ai/client";
import { buildMutationPrompt } from "@/lib/ai/prompts";

/**
 * Perform mutation on a parent prompt.
 * Returns the mutated prompt text.
 */
export async function performMutation(
  ai: GemmaClient,
  taskDescription: string,
  parent: Prompt,
  mutationType: MutationType,
): Promise<string> {
  const prompt = buildMutationPrompt(
    taskDescription,
    parent.text,
    mutationType,
    parent.fitness ?? 0,
  );

  const result = await ai.generate({
    prompt,
    temperature: 0.7,
    maxTokens: 1024,
  });

  return cleanPromptText(result.text);
}

/**
 * Randomly select a mutation type from the configured strategies.
 */
export function selectMutationType(strategies: MutationType[]): MutationType {
  return strategies[Math.floor(Math.random() * strategies.length)];
}

function cleanPromptText(text: string): string {
  let cleaned = text.trim();

  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
  }

  return cleaned.trim();
}
