import { NextResponse } from "next/server";
import * as queries from "@/lib/db/queries";

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

  const testCases = queries.getTestCasesForRun(id);
  const prompts = queries.getPromptsForRun(id);

  // Compute generation summaries from prompts
  const generationMap = new Map<number, typeof prompts>();
  for (const p of prompts) {
    const gen = p.generation;
    if (!generationMap.has(gen)) generationMap.set(gen, []);
    generationMap.get(gen)!.push(p);
  }

  const generationSummaries = Array.from(generationMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([generation, genPrompts]) => {
      const fitnesses = genPrompts
        .map((p) => p.fitness ?? 0)
        .sort((a, b) => b - a);

      const bestPrompt = genPrompts.reduce((best, p) =>
        (p.fitness ?? 0) > (best.fitness ?? 0) ? p : best,
      );

      return {
        generation,
        bestFitness: fitnesses[0] ?? 0,
        meanFitness: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
        worstFitness: fitnesses[fitnesses.length - 1] ?? 0,
        bestPrompt,
        populationSize: genPrompts.length,
      };
    });

  return NextResponse.json({
    run,
    testCases,
    prompts,
    generationSummaries,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const run = queries.getRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  queries.deleteRun(id);
  return NextResponse.json({ deleted: true });
}
