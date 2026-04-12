"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import type { RunStatus, StopReason } from "@/lib/engine/types";

interface GenerationProgressProps {
  currentGeneration: number;
  totalGenerations: number;
  evaluationProgress: { evaluated: number; total: number } | null;
  status: RunStatus;
  stopReason?: StopReason | null;
}

export function GenerationProgress({
  currentGeneration,
  totalGenerations,
  evaluationProgress,
  status,
  stopReason,
}: GenerationProgressProps) {
  const isTerminal = ["completed", "stopped", "failed"].includes(status);
  const isActive = status === "running" || status === "initializing";

  const generationPercent = isTerminal
    ? 100
    : totalGenerations > 0
      ? (currentGeneration / totalGenerations) * 100
      : 0;

  const evalPercent =
    evaluationProgress && evaluationProgress.total > 0
      ? (evaluationProgress.evaluated / evaluationProgress.total) * 100
      : null;

  const stopReasonLabel: Record<string, string> = {
    "fitness-reached": "Target fitness reached",
    "early-convergence": "Converged early",
    "user-stopped": "Stopped by user",
    "api-error": "API error",
  };

  const genLabel = isTerminal
    ? `${currentGeneration} generation${currentGeneration !== 1 ? "s" : ""} completed`
    : `Generation ${currentGeneration} / ${totalGenerations}`;

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {isActive && (
            <Activity className="h-3.5 w-3.5 text-primary animate-pulse" />
          )}
          <span className="font-medium">{genLabel}</span>
          {isTerminal && stopReason && (
            <Badge variant="secondary" className="text-[11px]">
              {stopReasonLabel[stopReason] ?? stopReason}
            </Badge>
          )}
          {status === "completed" && !stopReason && (
            <Badge
              variant="outline"
              className="text-[11px] bg-success/10 text-success border-success/20"
            >
              Completed
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {Math.round(generationPercent)}%
        </span>
      </div>
      <Progress value={generationPercent} className="h-2" />

      {isActive && evalPercent !== null && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Evaluating: {evaluationProgress!.evaluated} /{" "}
              {evaluationProgress!.total}
            </span>
            <span className="font-mono tabular-nums">
              {Math.round(evalPercent)}%
            </span>
          </div>
          <Progress value={evalPercent} className="h-1" />
        </div>
      )}
    </div>
  );
}
