import { NextResponse } from "next/server";
import * as queries from "@/lib/db/queries";
import { isRunActive } from "@/lib/engine/run-registry";
import {
  enforceRouteRateLimit,
  requireTrustedLocalRequest,
} from "@/lib/utils/request-security";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const run = queries.getRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const config =
    typeof run.config === "string"
      ? JSON.parse(run.config as string)
      : run.config;
  const testCases = queries.getTestCasesForRun(id);
  const prompts = queries.getPromptsForRun(id);

  // Compute summaries only for fully evaluated generations.
  // This prevents partially created next generations from looking complete.
  const generationMap = new Map<number, typeof prompts>();
  for (const p of prompts) {
    const gen = p.generation;
    if (!generationMap.has(gen)) generationMap.set(gen, []);
    generationMap.get(gen)!.push(p);
  }

  const generationSummaries = Array.from(generationMap.entries())
    .sort(([a], [b]) => a - b)
    .filter(([, genPrompts]) => {
      const expectedPopulationSize = config.populationSize ?? 0;
      const isFullyEvaluated = genPrompts.every((prompt) => prompt.fitness !== null);

      if (!isFullyEvaluated) {
        return false;
      }

      if (expectedPopulationSize <= 0) {
        return true;
      }

      return genPrompts.length >= expectedPopulationSize;
    })
    .map(([promptGeneration, genPrompts]) => {
      const fitnesses = genPrompts
        .map((p) => p.fitness ?? 0)
        .sort((a, b) => b - a);

      const bestPrompt = genPrompts.reduce((best, p) =>
        (p.fitness ?? 0) > (best.fitness ?? 0) ? p : best,
      );

      return {
        generation: promptGeneration + 1,
        bestFitness: fitnesses[0] ?? 0,
        meanFitness: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
        worstFitness: fitnesses[fitnesses.length - 1] ?? 0,
        bestPrompt,
        populationSize: genPrompts.length,
      };
    });

  return NextResponse.json({
    run: {
      ...run,
      config,
    },
    testCases,
    prompts,
    generationSummaries,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const accessError = requireTrustedLocalRequest(request, "Run delete");
  if (accessError) {
    return accessError;
  }

  const rateLimitError = enforceRouteRateLimit(request, "run-delete", {
    limit: 10,
    windowMs: 60_000,
  });
  if (rateLimitError) {
    return rateLimitError;
  }

  const { id } = await params;

  const run = queries.getRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (
    ["pending", "initializing", "running"].includes(run.status) ||
    isRunActive(id)
  ) {
    return NextResponse.json(
      {
        error:
          "Cannot delete an active run. Stop it first and wait for a terminal state.",
      },
      { status: 409 },
    );
  }

  queries.deleteRun(id);
  return NextResponse.json({ deleted: true });
}
