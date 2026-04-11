import type { GemmaClient } from "@/lib/ai/client";
import type { Prompt } from "./types";
import { buildSeedGeneratorPrompt } from "@/lib/ai/prompts";
import * as queries from "@/lib/db/queries";

/**
 * Initialize the starting population for an evolution run.
 * Combines user-provided seed prompts with LLM-generated ones
 * to reach the target population size.
 */
export async function initializePopulation(
  ai: GemmaClient,
  runId: string,
  taskDescription: string,
  populationSize: number,
  userSeeds: string[],
): Promise<Prompt[]> {
  const population: Prompt[] = [];

  // Add user-provided seeds
  for (const text of userSeeds) {
    const prompt = queries.createPrompt({
      runId,
      generation: 0,
      text,
      origin: { type: "seed", source: "user" },
      parentIds: [],
    });
    population.push(toPrompt(prompt));
  }

  // Generate remaining seeds via LLM
  const needed = populationSize - population.length;
  if (needed > 0) {
    const seedPrompt = buildSeedGeneratorPrompt(
      taskDescription,
      userSeeds,
      needed,
    );

    const result = await ai.generate({
      prompt: seedPrompt,
      temperature: 0.9,
      jsonMode: true,
      maxTokens: 4096,
    });

    const texts = parseSeedResponse(result.text, needed);

    for (const text of texts) {
      const prompt = queries.createPrompt({
        runId,
        generation: 0,
        text,
        origin: { type: "seed", source: "generated" },
        parentIds: [],
      });
      population.push(toPrompt(prompt));
    }
  }

  return population;
}

/**
 * Parse LLM response for seed generation.
 * Expects a JSON array of strings, but handles common LLM quirks.
 */
function parseSeedResponse(response: string, expected: number): string[] {
  try {
    // Try direct JSON parse
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === "string").slice(0, expected);
    }
  } catch {
    // Try extracting JSON array from response
    const match = response.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          return parsed.filter((s): s is string => typeof s === "string").slice(0, expected);
        }
      } catch {
        // Fall through to line-based extraction
      }
    }
  }

  // Fallback: split by newlines, take non-empty lines
  const lines = response
    .split("\n")
    .map((l) => l.replace(/^\d+\.\s*/, "").replace(/^["']|["']$/g, "").trim())
    .filter((l) => l.length > 10 && l.includes("{input}"));

  return lines.slice(0, expected);
}

/**
 * Convert DB row to domain Prompt type.
 */
function toPrompt(row: ReturnType<typeof queries.createPrompt>): Prompt {
  return {
    id: row.id,
    runId: row.runId,
    generation: row.generation,
    text: row.text,
    fitness: row.fitness ?? null,
    parentIds: (row.parentIds ?? []) as string[],
    origin: row.origin as Prompt["origin"],
    metadata: (row.metadata ?? null) as Prompt["metadata"],
  };
}
