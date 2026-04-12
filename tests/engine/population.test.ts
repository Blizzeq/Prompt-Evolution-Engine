import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPromptMock } = vi.hoisted(() => ({
  createPromptMock: vi.fn((data: {
    runId: string;
    generation: number;
    text: string;
    origin: unknown;
    parentIds: string[];
  }) => ({
    id: crypto.randomUUID(),
    runId: data.runId,
    generation: data.generation,
    text: data.text,
    fitness: null,
    parentIds: data.parentIds,
    origin: data.origin,
    metadata: null,
  })),
}));

vi.mock("@/lib/db/queries", () => ({
  createPrompt: createPromptMock,
}));

import { initializePopulation } from "../../src/lib/engine/population";

describe("initializePopulation", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createPromptMock.mockClear();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("tops up the population when the LLM returns too few seeds", async () => {
    const ai = {
      generate: vi.fn().mockResolvedValue({
        text: JSON.stringify(["LLM seed prompt with {input}"]),
      }),
    };

    const population = await initializePopulation(
      ai as never,
      "run-1",
      "Classify sentiment",
      3,
      [],
    );

    expect(population).toHaveLength(3);
    expect(population.every((prompt) => prompt.text.includes("{input}"))).toBe(
      true,
    );
    expect(createPromptMock).toHaveBeenCalledTimes(3);
  });

  it("falls back to template seeds when generation fails entirely", async () => {
    const ai = {
      generate: vi.fn().mockRejectedValue(new Error("provider failed")),
    };

    const population = await initializePopulation(
      ai as never,
      "run-2",
      "Summarize documents",
      2,
      [],
    );

    expect(population).toHaveLength(2);
    expect(population.every((prompt) => prompt.text.includes("{input}"))).toBe(
      true,
    );
  });
});
