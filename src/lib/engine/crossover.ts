import type { CrossoverStrategy, Prompt } from "./types";
import type { GemmaClient } from "@/lib/ai/client";
import {
  buildSimpleCrossoverPrompt,
  buildSectionAwareCrossoverPrompt,
  buildDifferentialEvolutionPrompt,
} from "@/lib/ai/prompts";
import { tournamentSelect } from "./selection";

/**
 * Perform crossover on two parents using the configured strategy.
 * Returns the child prompt text.
 */
export async function performCrossover(
  ai: GemmaClient,
  taskDescription: string,
  parent1: Prompt,
  parent2: Prompt,
  strategy: CrossoverStrategy,
  population: Prompt[],
): Promise<string> {
  let prompt: string;

  const p1 = { text: parent1.text, fitness: parent1.fitness ?? 0 };
  const p2 = { text: parent2.text, fitness: parent2.fitness ?? 0 };

  switch (strategy) {
    case "simple":
      prompt = buildSimpleCrossoverPrompt(taskDescription, p1, p2);
      break;

    case "section-aware":
      prompt = buildSectionAwareCrossoverPrompt(taskDescription, p1, p2);
      break;

    case "differential": {
      // DE needs 3 distinct individuals: base + 2 diff vectors
      const base = p1;
      const [diff1, diff2] = getDEDiffPair(population, parent1, parent2);
      prompt = buildDifferentialEvolutionPrompt(
        taskDescription,
        base,
        { text: diff1.text, fitness: diff1.fitness ?? 0 },
        { text: diff2.text, fitness: diff2.fitness ?? 0 },
      );
      break;
    }
  }

  const result = await ai.generate({
    prompt,
    temperature: 0.7,
    maxTokens: 1024,
  });

  return cleanPromptText(result.text);
}

/**
 * Get two random distinct individuals for DE diff vector,
 * excluding the two parents already selected.
 */
function getDEDiffPair(
  population: Prompt[],
  exclude1: Prompt,
  exclude2: Prompt,
): [Prompt, Prompt] {
  const candidates = population.filter(
    (p) => p.id !== exclude1.id && p.id !== exclude2.id,
  );

  if (candidates.length < 2) {
    // Fallback: use the excluded parents if not enough candidates
    return [exclude1, exclude2];
  }

  const selected = tournamentSelect(candidates, 2);
  return [selected[0], selected[1]];
}

/**
 * Clean up LLM-generated prompt text — remove wrapping quotes,
 * markdown code blocks, or other artifacts.
 */
function cleanPromptText(text: string): string {
  let cleaned = text.trim();

  // Remove wrapping quotes
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }

  // Remove markdown code blocks
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
  }

  return cleaned.trim();
}
