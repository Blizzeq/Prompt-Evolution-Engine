import { NextResponse } from "next/server";
import { stopRun } from "@/lib/engine/run-registry";
import * as queries from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const run = queries.getRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const stopped = stopRun(id);
  if (!stopped) {
    return NextResponse.json(
      { error: "Run is not active or already stopped" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
