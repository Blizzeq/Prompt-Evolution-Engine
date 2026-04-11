import { NextResponse } from "next/server";
import * as queries from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const runs = queries.listRuns();

  const enrichedRuns = runs.map((run) => {
    const testCases = queries.getTestCasesForRun(run.id);
    let bestPromptText: string | null = null;

    if (run.bestPromptId) {
      const prompts = queries.getPromptsForRun(run.id);
      const best = prompts.find((p) => p.id === run.bestPromptId);
      bestPromptText = best?.text ?? null;
    }

    return {
      ...run,
      testCaseCount: testCases.length,
      bestPromptText,
    };
  });

  return NextResponse.json({ runs: enrichedRuns });
}
