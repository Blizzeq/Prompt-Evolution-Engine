import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getRunMock,
  getTestCasesForRunMock,
  getPromptsForRunMock,
} = vi.hoisted(() => ({
  getRunMock: vi.fn(),
  getTestCasesForRunMock: vi.fn(),
  getPromptsForRunMock: vi.fn(),
}));

vi.mock("@/lib/db/queries", () => ({
  getRun: getRunMock,
  getTestCasesForRun: getTestCasesForRunMock,
  getPromptsForRun: getPromptsForRunMock,
}));

vi.mock("@/lib/engine/run-registry", () => ({
  isRunActive: vi.fn(() => false),
}));

vi.mock("@/lib/utils/request-security", () => ({
  requireTrustedLocalRequest: vi.fn(() => null),
  enforceRouteRateLimit: vi.fn(() => null),
}));

import { GET } from "../../src/app/api/evolution/[id]/route";

describe("GET /api/evolution/[id]", () => {
  beforeEach(() => {
    getRunMock.mockReset();
    getTestCasesForRunMock.mockReset();
    getPromptsForRunMock.mockReset();
  });

  it("excludes incomplete generations from generation summaries", async () => {
    getRunMock.mockReturnValue({
      id: "run-1",
      config: {
        populationSize: 3,
        generations: 5,
      },
      status: "running",
    });
    getTestCasesForRunMock.mockReturnValue([]);
    getPromptsForRunMock.mockReturnValue([
      {
        id: "g0-a",
        runId: "run-1",
        generation: 0,
        text: "seed a",
        fitness: 0.8,
        parentIds: [],
        origin: { type: "seed", source: "generated" },
        metadata: null,
      },
      {
        id: "g0-b",
        runId: "run-1",
        generation: 0,
        text: "seed b",
        fitness: 0.7,
        parentIds: [],
        origin: { type: "seed", source: "generated" },
        metadata: null,
      },
      {
        id: "g0-c",
        runId: "run-1",
        generation: 0,
        text: "seed c",
        fitness: 0.6,
        parentIds: [],
        origin: { type: "seed", source: "generated" },
        metadata: null,
      },
      {
        id: "g1-a",
        runId: "run-1",
        generation: 1,
        text: "elite a",
        fitness: 0.9,
        parentIds: ["g0-a"],
        origin: { type: "elite", originalId: "g0-a" },
        metadata: null,
      },
      {
        id: "g1-b",
        runId: "run-1",
        generation: 1,
        text: "offspring b",
        fitness: 0.85,
        parentIds: ["g0-a", "g0-b"],
        origin: {
          type: "crossover",
          parents: ["g0-a", "g0-b"],
          strategy: "simple",
        },
        metadata: null,
      },
      {
        id: "g1-c",
        runId: "run-1",
        generation: 1,
        text: "offspring c",
        fitness: null,
        parentIds: ["g0-c"],
        origin: {
          type: "mutation",
          parent: "g0-c",
          mutationType: "rephrase",
        },
        metadata: null,
      },
    ]);

    const response = await GET(new Request("http://localhost/api/evolution/run-1"), {
      params: Promise.resolve({ id: "run-1" }),
    });
    const payload = await response.json();

    expect(payload.generationSummaries).toHaveLength(1);
    expect(payload.generationSummaries[0]).toEqual(
      expect.objectContaining({
        generation: 1,
        populationSize: 3,
        bestFitness: 0.8,
      }),
    );
  });
});