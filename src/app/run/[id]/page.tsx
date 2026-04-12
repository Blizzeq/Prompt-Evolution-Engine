"use client";

import { use, useEffect } from "react";
import { useEvolutionStore } from "@/stores/evolution-store";
import { useEvolutionStream, useRunData } from "@/hooks/use-evolution-stream";
import { RunControls } from "@/components/dashboard/run-controls";
import { GenerationProgress } from "@/components/dashboard/generation-progress";
import { CurrentBest } from "@/components/dashboard/current-best";
import { FitnessChart } from "@/components/dashboard/fitness-chart";
import { PopulationTable } from "@/components/dashboard/population-table";
import { GenealogyDag } from "@/components/dashboard/genealogy-dag";
import { RunResults } from "@/components/dashboard/run-results";
import { OriginalPrompt } from "@/components/dashboard/original-prompt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Plus, WifiOff } from "lucide-react";
import Link from "next/link";

export default function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const reset = useEvolutionStore((s) => s.reset);
  const status = useEvolutionStore((s) => s.status);
  const stopReason = useEvolutionStore((s) => s.stopReason);
  const errorMessage = useEvolutionStore((s) => s.errorMessage);
  const currentGeneration = useEvolutionStore((s) => s.currentGeneration);
  const totalGenerations = useEvolutionStore((s) => s.totalGenerations);
  const evaluationProgress = useEvolutionStore((s) => s.evaluationProgress);
  const fitnessHistory = useEvolutionStore((s) => s.fitnessHistory);
  const generationSummaries = useEvolutionStore((s) => s.generationSummaries);
  const bestPrompt = useEvolutionStore((s) => s.bestPrompt);
  const summary = useEvolutionStore((s) => s.summary);
  const userPrompt = useEvolutionStore((s) => s.userPrompt);
  const taskDescription = useEvolutionStore((s) => s.taskDescription);
  const loadState = useEvolutionStore((s) => s.loadState);
  const connectionStatus = useEvolutionStore((s) => s.connectionStatus);

  // Reset store when mounting with a new run
  useEffect(() => {
    reset();
  }, [id, reset]);

  // Fetch initial state from DB
  useRunData(id);

  // Connect to SSE stream
  useEvolutionStream(id);

  const isTerminal = ["completed", "stopped", "failed"].includes(status);

  if (loadState === "not-found") {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Run Not Found
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This run does not exist anymore or was removed from the local database.
            </p>
            <div className="flex gap-2">
              <Link href="/history">
                <Button variant="outline">Open History</Button>
              </Link>
              <Link href="/new">
                <Button>Start New Run</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Evolution Run
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {id}
          </p>
        </div>
        {isTerminal && (
          <Link href="/new">
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              New Run
            </Button>
          </Link>
        )}
      </div>

      {/* Controls: status + stop button */}
      <RunControls
        runId={id}
        status={status}
        stopReason={stopReason}
        errorMessage={errorMessage}
      />

      {connectionStatus === "disconnected" && !isTerminal && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          <WifiOff className="h-4 w-4" />
          Live updates disconnected. Refresh the page to resync from the database.
        </div>
      )}

      {loadState === "error" && status === "pending" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Failed to load run data from the API.
        </div>
      )}

      <Separator />

      {/* Original prompt — for comparison with the optimized result */}
      {(userPrompt || taskDescription) && (
        <OriginalPrompt
          userPrompt={userPrompt}
          taskDescription={taskDescription ?? ""}
        />
      )}

      {/* Progress */}
      {(status === "running" || status === "initializing" || totalGenerations > 0) && (
        <GenerationProgress
          currentGeneration={currentGeneration}
          totalGenerations={totalGenerations}
          evaluationProgress={evaluationProgress}
          status={status}
          stopReason={stopReason}
        />
      )}

      {/* Loading skeleton for initial state */}
      {status === "pending" && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      )}

      {/* Results card when completed */}
      {summary && <RunResults summary={summary} />}

      {/* Fitness chart (full width — Best Prompt is already in Results/RunResults) */}
      {fitnessHistory.length > 0 && (
        <FitnessChart data={fitnessHistory} />
      )}

      {/* Show current best only while running (before results are available) */}
      {!summary && bestPrompt && (
        <CurrentBest prompt={bestPrompt} />
      )}

      {/* Genealogy DAG */}
      {(isTerminal || generationSummaries.length > 0) && <GenealogyDag runId={id} />}

      {/* Generation summary table */}
      <PopulationTable
        generationSummaries={generationSummaries}
        currentGeneration={currentGeneration}
      />
    </div>
  );
}
