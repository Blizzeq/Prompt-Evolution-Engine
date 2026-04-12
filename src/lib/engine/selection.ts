import type { Prompt } from "./types";

/**
 * Tournament selection: pick `tournamentSize` random candidates,
 * return the one with highest fitness. Repeat `count` times.
 */
export function tournamentSelect(
  population: Prompt[],
  count: number,
  tournamentSize = 3,
): Prompt[] {
  if (population.length === 0) {
    throw new Error("Cannot select from an empty population");
  }

  const size = Math.min(tournamentSize, population.length);
  const selected: Prompt[] = [];

  for (let i = 0; i < count; i++) {
    const candidates = shuffle([...population]).slice(0, size);
    candidates.sort((a, b) => (b.fitness ?? 0) - (a.fitness ?? 0));
    selected.push(candidates[0]);
  }

  return selected;
}

/**
 * Select elites: top-K individuals by fitness.
 */
export function selectElites(population: Prompt[], eliteCount: number): Prompt[] {
  return [...population]
    .sort((a, b) => (b.fitness ?? 0) - (a.fitness ?? 0))
    .slice(0, eliteCount);
}

/**
 * Fisher-Yates shuffle (in-place).
 */
function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
