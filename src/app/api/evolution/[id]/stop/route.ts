import { NextResponse } from "next/server";
import { stopRun } from "@/lib/engine/run-registry";
import * as queries from "@/lib/db/queries";
import {
  enforceRouteRateLimit,
  requireTrustedLocalRequest,
} from "@/lib/utils/request-security";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const accessError = requireTrustedLocalRequest(request, "Run stop");
  if (accessError) {
    return accessError;
  }

  const rateLimitError = enforceRouteRateLimit(request, "run-stop", {
    limit: 20,
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

  if (["completed", "stopped", "failed"].includes(run.status)) {
    return NextResponse.json(
      { error: `Run is already ${run.status}` },
      { status: 409 },
    );
  }

  const stopped = stopRun(id);
  if (!stopped) {
    return NextResponse.json(
      { error: "Run is not active or already stopped" },
      { status: 409 },
    );
  }

  if (run.status === "pending" || run.status === "initializing") {
    queries.updateRunProgress(id, {
      status: "stopped",
      stoppedReason: "user-stopped",
      completedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ success: true });
}
