"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Clock,
  Database,
  Dna,
  History,
  Loader2,
  Plus,
  Sparkles,
  StopCircle,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { RunStatus } from "@/lib/engine/types";
import { parseDbDate } from "@/lib/utils/dates";

interface RunRow {
  id: string;
  taskDescription: string;
  status: RunStatus;
  currentGeneration: number;
  bestFitness: number | null;
  totalApiCalls: number;
  startedAt: string;
  completedAt: string | null;
  stoppedReason: string | null;
  config: {
    generations: number;
    populationSize: number;
    provider: string;
    modelId: string;
  };
  testCaseCount: number;
  bestPromptText: string | null;
}

function statusBadge(status: RunStatus) {
  const base = "gap-1 text-[11px]";
  switch (status) {
    case "completed":
      return (
        <Badge
          variant="outline"
          className={`${base} border-success/20 bg-success/10 text-success`}
        >
          <CheckCircle2 className="h-3 w-3" /> Completed
        </Badge>
      );
    case "running":
    case "initializing":
      return (
        <Badge
          variant="outline"
          className={`${base} border-primary/20 bg-primary/10 text-primary`}
        >
          <Loader2 className="h-3 w-3 animate-spin" /> Running
        </Badge>
      );
    case "stopped":
      return (
        <Badge variant="secondary" className={base}>
          <StopCircle className="h-3 w-3" /> Stopped
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className={`${base} border-destructive/20 bg-destructive/10 text-destructive`}
        >
          <XCircle className="h-3 w-3" /> Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={base}>
          <Clock className="h-3 w-3" /> {status}
        </Badge>
      );
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(parseDbDate(dateStr));
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const stats = useMemo(() => {
    const completedRuns = runs.filter((run) => run.status === "completed").length;
    const activeRuns = runs.filter(
      (run) => run.status === "running" || run.status === "initializing"
    ).length;
    const fitnessValues = runs
      .map((run) => run.bestFitness)
      .filter((value): value is number => value != null);

    return {
      completedRuns,
      activeRuns,
      bestFitness:
        fitnessValues.length > 0 ? Math.max(...fitnessValues) * 100 : null,
    };
  }, [runs]);

  const fetchRuns = async () => {
    try {
      const res = await fetch("/api/runs");
      const data = await res.json();
      setRuns(data.runs ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/evolution/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to delete run");
        return;
      }
      setRuns((prev) => prev.filter((r) => r.id !== id));
      toast.success("Run deleted");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <motion.div
      className="space-y-6 pb-20 lg:space-y-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_24rem]">
        <div className="panel-strong hero-gradient relative overflow-hidden rounded-[2rem] px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-11">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_65%)] lg:block" />
          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                <History className="h-3 w-3" />
                Archive
              </Badge>
              <Badge variant="secondary">Run records</Badge>
            </div>

            <div className="space-y-4">
              <h1 className="text-[2.2rem] font-semibold leading-[0.98] tracking-[-0.08em] text-foreground sm:text-[3rem] lg:text-[4rem]">
                Review completed runs and reopen the ones worth keeping.
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Status, score, provider, and key run details stay visible without opening every record.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="panel-soft rounded-[1.35rem] p-4">
                <p className="section-kicker">Total runs</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                  {runs.length}
                </p>
              </div>
              <div className="panel-soft rounded-[1.35rem] p-4">
                <p className="section-kicker">Active</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                  {stats.activeRuns}
                </p>
              </div>
              <div className="panel-soft rounded-[1.35rem] p-4">
                <p className="section-kicker">Peak fitness</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                  {stats.bestFitness != null ? `${stats.bestFitness.toFixed(1)}%` : "--"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="panel rounded-[1.75rem] p-5 sm:p-6">
          <p className="section-kicker">Archive summary</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
            Current state
          </h2>

          <div className="mt-5 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Completed runs
              </span>
              <span className="font-medium text-foreground">{stats.completedRuns}</span>
            </div>
            <div className="flex items-center justify-between rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Live experiments
              </span>
              <span className="font-medium text-foreground">{stats.activeRuns}</span>
            </div>
            <div className="flex items-center justify-between rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
              <span className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Local archive
              </span>
              <span className="font-medium text-foreground">SQLite</span>
            </div>
          </div>

          <Link href="/new" className="mt-5 block">
            <Button className="w-full gap-2">
              <Plus className="h-4 w-4" />
              New run
            </Button>
          </Link>
        </div>
      </section>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-56 w-full rounded-[1.75rem]" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="rounded-[1.9rem]">
            <CardContent className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-primary/10 text-primary">
                <Dna className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold tracking-[-0.04em] text-foreground">
                No runs yet
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Start a run and it will appear here with its score, status, and history.
              </p>
              <Link href="/new" className="mt-6 inline-block">
                <Button className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Start first run
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {runs.map((run, index) => {
            const isActive = ["pending", "initializing", "running"].includes(
              run.status
            );

            return (
              <motion.div
                key={run.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.28 }}
              >
                <Card className="h-full rounded-[1.75rem] border-white/10 bg-white/[0.08] dark:border-white/6 dark:bg-white/[0.04]">
                  <CardContent className="flex h-full flex-col gap-5 py-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-3">
                        {statusBadge(run.status)}
                        <div>
                          <h2 className="text-lg font-semibold tracking-[-0.04em] text-foreground">
                            {truncate(run.taskDescription, 84)}
                          </h2>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {run.config.provider} / {run.config.modelId} / {run.testCaseCount} test{run.testCaseCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-[1.15rem] border border-success/20 bg-success/10 px-3 py-2 text-right">
                        <p className="text-[0.62rem] uppercase tracking-[0.24em] text-success/80">
                          Fitness
                        </p>
                        <p className="mt-1 font-mono text-sm text-success">
                          {run.bestFitness != null ? `${(run.bestFitness * 100).toFixed(1)}%` : "--"}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          <Sparkles className="h-3.5 w-3.5" />
                          Generation
                        </div>
                        <p className="mt-2 text-base font-medium text-foreground">
                          {run.currentGeneration}/{run.config.generations}
                        </p>
                      </div>
                      <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          <Database className="h-3.5 w-3.5" />
                          API calls
                        </div>
                        <p className="mt-2 text-base font-medium text-foreground">
                          {run.totalApiCalls}
                        </p>
                      </div>
                      <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          <CalendarRange className="h-3.5 w-3.5" />
                          Started
                        </div>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {formatDate(run.startedAt)}
                        </p>
                      </div>
                      <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          End state
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm font-medium text-foreground">
                          {run.stoppedReason ?? (run.completedAt ? formatDate(run.completedAt) : "In progress")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        Run ID: <span className="font-mono">{run.id}</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <Link href={`/run/${run.id}`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            Open run
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(run.id)}
                          disabled={deleting === run.id || isActive}
                          aria-label={`Delete run ${run.id}`}
                        >
                          {deleting === run.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </section>
      )}
    </motion.div>
  );
}
