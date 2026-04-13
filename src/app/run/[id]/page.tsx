"use client";

import { use, useEffect } from "react";
import { motion, type Variants } from "framer-motion";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Square,
  WifiOff,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="border-success/20 bg-success/8 text-success">
          <CheckCircle2 className="h-3 w-3" /> Completed
        </Badge>
      );
    case "running":
    case "initializing":
      return (
        <Badge variant="outline" className="border-primary/20 bg-primary/8 text-primary">
          <Loader2 className="h-3 w-3 animate-spin" />
          {status === "running" ? "Running" : "Initializing"}
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="border-destructive/20 bg-destructive/8 text-destructive">
          <XCircle className="h-3 w-3" /> Failed
        </Badge>
      );
    case "stopped":
      return (
        <Badge variant="outline" className="border-muted bg-muted/40 text-muted-foreground">
          <Square className="h-3 w-3" /> Stopped
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

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

  useEffect(() => {
    reset();
  }, [id, reset]);

  useRunData(id);
  useEvolutionStream(id);

  const isTerminal = ["completed", "stopped", "failed"].includes(status);
  const runTitle = taskDescription || userPrompt || "Evolution run";
  const runHeading =
    runTitle.length > 120 ? `${runTitle.slice(0, 120).trim()}...` : runTitle;

  if (loadState === "not-found") {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">Run not found</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This run no longer exists or the ID is invalid.
        </p>
        <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
          {id}
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link href="/">
            <Button variant="outline" size="sm">Dashboard</Button>
          </Link>
          <Link href="/new">
            <Button size="sm">New Run</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {statusBadge(status)}
          {connectionStatus === "disconnected" && !isTerminal && (
            <Badge variant="outline" className="border-warning/20 bg-warning/8 text-warning">
              <WifiOff className="h-3 w-3" /> Disconnected
            </Badge>
          )}
        </div>

        <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {runHeading}
        </h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/40 bg-card/80 px-4 py-3.5">
          <p className="text-[0.7rem] font-medium text-muted-foreground">Generation</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
            {totalGenerations > 0 ? `${currentGeneration}/${totalGenerations}` : "--"}
          </p>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/80 px-4 py-3.5">
          <p className="text-[0.7rem] font-medium text-muted-foreground">Best fitness</p>
          <p className={cn(
            "mt-0.5 text-xl font-semibold tracking-tight",
            bestPrompt?.fitness != null ? "text-success" : "text-foreground"
          )}>
            {bestPrompt?.fitness != null ? `${(bestPrompt.fitness * 100).toFixed(1)}%` : "--"}
          </p>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/80 px-4 py-3.5">
          <p className="text-[0.7rem] font-medium text-muted-foreground">Data points</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
            {fitnessHistory.length}
          </p>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/80 px-4 py-3.5">
          <p className="text-[0.7rem] font-medium text-muted-foreground">Summaries</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
            {generationSummaries.length}
          </p>
        </div>
      </div>

      {/* Run controls */}
      <div className="rounded-xl border border-border/40 bg-card/80 px-5 py-4">
        <RunControls
          runId={id}
          status={status}
          stopReason={stopReason}
          errorMessage={errorMessage}
        />
      </div>

      {/* Alerts */}
      {connectionStatus === "disconnected" && !isTerminal && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning-foreground">
          <WifiOff className="h-4 w-4 shrink-0" />
          Live updates disconnected. Refresh the page to resync.
        </div>
      )}

      {loadState === "error" && status === "pending" && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Failed to load run data from the API.
        </div>
      )}

      {/* Main content */}
      <div className="space-y-5">
        {(userPrompt || taskDescription) && (
          <motion.div variants={fadeIn} initial="hidden" animate="visible" custom={1}>
            <OriginalPrompt
              userPrompt={userPrompt}
              taskDescription={taskDescription ?? ""}
            />
          </motion.div>
        )}

        {(status === "running" || status === "initializing" || totalGenerations > 0) && (
          <motion.div variants={fadeIn} initial="hidden" animate="visible" custom={2}>
            <GenerationProgress
              currentGeneration={currentGeneration}
              totalGenerations={totalGenerations}
              evaluationProgress={evaluationProgress}
              status={status}
              stopReason={stopReason}
            />
          </motion.div>
        )}

        {status === "pending" && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64 rounded-lg" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-[300px] w-full rounded-xl" />
          </div>
        )}

        {!summary && bestPrompt && (
          <motion.div variants={fadeIn} initial="hidden" animate="visible" custom={3}>
            <CurrentBest prompt={bestPrompt} />
          </motion.div>
        )}

        {summary && (
          <motion.div variants={fadeIn} initial="hidden" animate="visible" custom={3}>
            <RunResults summary={summary} />
          </motion.div>
        )}

        {fitnessHistory.length > 0 && (
          <motion.div variants={fadeIn} initial="hidden" animate="visible" custom={4}>
            <FitnessChart data={fitnessHistory} />
          </motion.div>
        )}
      </div>

      {/* Bottom sections */}
      {(isTerminal || generationSummaries.length > 0) && (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" custom={5}>
          <GenealogyDag runId={id} />
        </motion.div>
      )}

      <motion.div variants={fadeIn} initial="hidden" animate="visible" custom={6}>
        <PopulationTable
          generationSummaries={generationSummaries}
          currentGeneration={currentGeneration}
        />
      </motion.div>
    </motion.div>
  );
}
