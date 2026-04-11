"use client";

import { Progress } from "@/components/ui/progress";
import type { RunStatus } from "@/lib/engine/types";

interface GenerationProgressProps {
  currentGeneration: number;
  totalGenerations: number;
  evaluationProgress: { evaluated: number; total: number } | null;
  status: RunStatus;
}

export function GenerationProgress({
  currentGeneration,
  totalGenerations,
  evaluationProgress,
  status,
}: GenerationProgressProps) {
  const generationPercent =
    totalGenerations > 0 ? (currentGeneration / totalGenerations) * 100 : 0;

  const evalPercent =
    evaluationProgress && evaluationProgress.total > 0
      ? (evaluationProgress.evaluated / evaluationProgress.total) * 100
      : null;

  const isActive = status === "running" || status === "initializing";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          Generation {currentGeneration} / {totalGenerations}
        </span>
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
