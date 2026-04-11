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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
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

  // Reset store when mounting with a new run
  useEffect(() => {
    reset();
  }, [id, reset]);

  // Fetch initial state from DB
  useRunData(id);

  // Connect to SSE stream
  useEvolutionStream(id);

  const isTerminal = ["completed", "stopped", "failed"].includes(status);

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

      <Separator />

      {/* Progress */}
      {(status === "running" || status === "initializing" || totalGenerations > 0) && (
        <GenerationProgress
          currentGeneration={currentGeneration}
          totalGenerations={totalGenerations}
          evaluationProgress={evaluationProgress}
          status={status}
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

      {/* Chart + Best prompt side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FitnessChart data={fitnessHistory} />
        <CurrentBest prompt={bestPrompt} />
      </div>

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
