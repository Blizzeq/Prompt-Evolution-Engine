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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Dna,
  Plus,
  Square,
  Sparkles,
  WifiOff,
  XCircle,
} from "lucide-react";
import Link from "next/link";

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

function runStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge
          variant="outline"
          className="border-success/20 bg-success/10 text-success"
        >
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    case "running":
    case "initializing":
      return (
        <Badge
          variant="outline"
          className="border-primary/20 bg-primary/10 text-primary"
        >
          <Activity className="h-3 w-3 animate-pulse" />
          {status === "running" ? "Running" : "Initializing"}
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="border-destructive/20 bg-destructive/10 text-destructive"
        >
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    case "stopped":
      return (
        <Badge variant="secondary">
          <Square className="h-3 w-3" />
          Stopped
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
    runTitle.length > 110 ? `${runTitle.slice(0, 110).trim()}...` : runTitle;
  const runDescription = isTerminal
    ? "Review the final prompt, metrics, and lineage for this run."
    : "Track progress, current best prompt, and lineage in one view.";

  if (loadState === "not-found") {
    return (
      <div className="mx-auto max-w-2xl py-16 sm:py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="rounded-[1.9rem] text-center">
            <CardContent className="space-y-5 py-14">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-destructive/10">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.04em] text-foreground">
                  Run not found
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  This run no longer exists in the local archive or the identifier is invalid.
                </p>
              </div>
              <p className="inline-block rounded-xl bg-white/[0.05] px-3 py-2 font-mono text-xs text-muted-foreground dark:bg-white/[0.03]">
                {id}
              </p>
              <div className="flex flex-col items-center justify-center gap-2 pt-2 sm:flex-row">
                <Link href="/history">
                  <Button variant="outline">Open History</Button>
                </Link>
                <Link href="/new">
                  <Button>Start New Run</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6 pb-20 lg:space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_24rem]">
        <div className="panel-strong hero-gradient relative overflow-hidden rounded-[2rem] px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-11">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_65%)] lg:block" />
          <div className="relative z-10 max-w-3xl space-y-6">
            <Link href="/history" className="inline-block">
              <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to archive
              </Button>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                <Dna className="h-3 w-3" />
                Run monitor
              </Badge>
              {runStatusBadge(status)}
              <Badge variant="secondary">
                {connectionStatus === "disconnected" ? "Disconnected" : "Live"}
              </Badge>
            </div>

            <div className="space-y-4">
              <h1 className="line-clamp-2 text-[2rem] font-semibold leading-[0.98] tracking-[-0.08em] text-foreground sm:text-[2.8rem] lg:text-[3.5rem]">
                {runHeading}
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {runDescription}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="panel-soft rounded-[1.35rem] p-4">
                <p className="section-kicker">Run ID</p>
                <p className="mt-2 truncate font-mono text-sm text-foreground">{id}</p>
              </div>
              <div className="panel-soft rounded-[1.35rem] p-4">
                <p className="section-kicker">Generations</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                  {totalGenerations > 0 ? `${currentGeneration}/${totalGenerations}` : "--"}
                </p>
              </div>
              <div className="panel-soft rounded-[1.35rem] p-4">
                <p className="section-kicker">Recorded points</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                  {fitnessHistory.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="panel rounded-[1.75rem] p-5 sm:p-6">
          <p className="section-kicker">Run status</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
            Run controls
          </h2>

          <div className="mt-5 space-y-4">
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4 dark:border-white/6 dark:bg-white/[0.03]">
              <RunControls
                runId={id}
                status={status}
                stopReason={stopReason}
                errorMessage={errorMessage}
              />
            </div>

            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
                <span>Load state</span>
                <span className="font-medium text-foreground">{loadState}</span>
              </div>
              <div className="flex items-center justify-between rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
                <span>Connection</span>
                <span className="font-medium text-foreground">{connectionStatus}</span>
              </div>
              <div className="flex items-center justify-between rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
                <span>Generations tracked</span>
                <span className="font-medium text-foreground">{generationSummaries.length}</span>
              </div>
            </div>

            {isTerminal ? (
              <Link href="/new" className="block">
                <Button className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  New run
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {connectionStatus === "disconnected" && !isTerminal ? (
        <motion.div
          className="panel rounded-[1.4rem] border-warning/25 bg-warning/5 px-5 py-4 text-sm text-warning-foreground"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 shrink-0" />
            Live updates disconnected. Refresh the page to resync the stream.
          </div>
        </motion.div>
      ) : null}

      {loadState === "error" && status === "pending" ? (
        <div className="panel rounded-[1.4rem] border-destructive/25 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Failed to load run data from the API.
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <div className="space-y-4">
          {(userPrompt || taskDescription) ? (
            <motion.div variants={fadeIn} initial="hidden" animate="visible" custom={1}>
              <OriginalPrompt
                userPrompt={userPrompt}
                taskDescription={taskDescription ?? ""}
              />
            </motion.div>
          ) : null}

          {(status === "running" || status === "initializing" || totalGenerations > 0) ? (
            <motion.div variants={fadeIn} initial="hidden" animate="visible" custom={2}>
              <GenerationProgress
                currentGeneration={currentGeneration}
                totalGenerations={totalGenerations}
                evaluationProgress={evaluationProgress}
                status={status}
                stopReason={stopReason}
              />
            </motion.div>
          ) : null}

          {status === "pending" ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64 rounded-lg" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-[300px] w-full rounded-[1.4rem]" />
            </div>
          ) : null}

          {summary ? (
            <motion.div variants={fadeIn} initial="hidden" animate="visible" custom={3}>
              <RunResults summary={summary} />
            </motion.div>
          ) : null}

          {fitnessHistory.length > 0 ? (
            <motion.div variants={fadeIn} initial="hidden" animate="visible" custom={4}>
              <FitnessChart data={fitnessHistory} />
            </motion.div>
          ) : null}
        </div>

        <motion.aside
          className="space-y-4 xl:sticky xl:top-24"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          custom={3}
        >
          {!summary ? <CurrentBest prompt={bestPrompt} /> : null}

          <Card className="rounded-[1.75rem] border-white/10 bg-white/[0.08] dark:border-white/6 dark:bg-white/[0.04]">
            <CardContent className="space-y-4 py-6">
              <div>
                <p className="section-kicker">Run summary</p>
                <h2 className="mt-2 text-lg font-semibold tracking-[-0.04em] text-foreground">
                  {isTerminal ? "Completed" : "In progress"}
                </h2>
              </div>

              <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-muted-foreground dark:border-white/6 dark:bg-white/[0.03]">
                {summary
                  ? "Final prompt, score history, and lineage are available below."
                  : "This panel updates as the run progresses and new results arrive."}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{generationSummaries.length} summaries</Badge>
                <Badge variant="secondary">{fitnessHistory.length} chart points</Badge>
                {bestPrompt?.fitness != null ? (
                  <Badge variant="outline" className="border-success/20 bg-success/10 text-success">
                    <Sparkles className="h-3 w-3" />
                    {(bestPrompt.fitness * 100).toFixed(1)}%
                  </Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </motion.aside>
      </section>

      {(isTerminal || generationSummaries.length > 0) ? (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" custom={5}>
          <GenealogyDag runId={id} />
        </motion.div>
      ) : null}

      <motion.div variants={fadeIn} initial="hidden" animate="visible" custom={6}>
        <PopulationTable
          generationSummaries={generationSummaries}
          currentGeneration={currentGeneration}
        />
      </motion.div>
    </motion.div>
  );
}
