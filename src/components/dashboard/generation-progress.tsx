"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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

  // Terminal runs always show 100% on the progress bar
  const generationPercent = isTerminal
    ? 100
    : totalGenerations > 0
      ? (currentGeneration / totalGenerations) * 100
      : 0;

  const evalPercent =
    evaluationProgress && evaluationProgress.total > 0
      ? (evaluationProgress.evaluated / evaluationProgress.total) * 100
      : null;

  // Stop reason labels
  const stopReasonLabel: Record<string, string> = {
    "fitness-reached": "Target fitness reached",
    "early-convergence": "Converged early (no improvement)",
    "user-stopped": "Stopped by user",
    "api-error": "Stopped due to API error",
  };

  // Generation label text
  const genLabel = isTerminal
    ? `${currentGeneration} generation${currentGeneration !== 1 ? "s" : ""} completed`
    : `Generation ${currentGeneration} / ${totalGenerations}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">{genLabel}</span>
          {isTerminal && stopReason && (
            <Badge variant="secondary" className="text-xs">
              {stopReasonLabel[stopReason] ?? stopReason}
            </Badge>
          )}
          {status === "completed" && !stopReason && (
            <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
              Completed
            </Badge>
          )}
        </div>
        <span className="text-muted-foreground">
          {Math.round(generationPercent)}%
        </span>
      </div>
      <Progress value={generationPercent} className="h-2" />

      {isActive && evalPercent !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Evaluating prompts: {evaluationProgress!.evaluated} /{" "}
              {evaluationProgress!.total}
            </span>
            <span>{Math.round(evalPercent)}%</span>
          </div>
          <Progress value={evalPercent} className="h-1" />
        </div>
      )}
    </div>
  );
}
