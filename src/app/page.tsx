"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Dna,
  Loader2,
  Plus,
  StopCircle,
  Trash2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { RunStatus } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

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

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function statusIcon(status: RunStatus) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-3 w-3" />;
    case "running":
    case "initializing":
      return <Loader2 className="h-3 w-3 animate-spin" />;
    case "stopped":
      return <StopCircle className="h-3 w-3" />;
    case "failed":
      return <XCircle className="h-3 w-3" />;
    default:
      return <Clock className="h-3 w-3" />;
  }
}

function statusColor(status: RunStatus) {
  switch (status) {
    case "completed":
      return "border-success/20 bg-success/8 text-success";
    case "running":
    case "initializing":
      return "border-primary/20 bg-primary/8 text-primary";
    case "failed":
      return "border-destructive/20 bg-destructive/8 text-destructive";
    default:
      return "border-muted bg-muted/40 text-muted-foreground";
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((data) => {
        setRuns(data.runs ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const active = runs.filter(
      (run) => run.status === "running" || run.status === "initializing"
    ).length;
    const fitnessValues = runs
      .map((run) => run.bestFitness)
      .filter((value): value is number => value != null);

    return {
      totalRuns: runs.length,
      activeRuns: active,
      averageFitness:
        fitnessValues.length > 0
          ? (fitnessValues.reduce((sum, v) => sum + v, 0) / fitnessValues.length) * 100
          : null,
      bestFitness:
        fitnessValues.length > 0 ? Math.max(...fitnessValues) * 100 : null,
    };
  }, [runs]);

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
      className="space-y-5"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Stat cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total runs", value: String(stats.totalRuns) },
          { label: "Active", value: String(stats.activeRuns), highlight: stats.activeRuns > 0 },
          { label: "Avg. fitness", value: stats.averageFitness != null ? `${stats.averageFitness.toFixed(1)}%` : "--" },
          { label: "Peak result", value: stats.bestFitness != null ? `${stats.bestFitness.toFixed(1)}%` : "--" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border/40 bg-card/80 px-4 py-3.5"
          >
            <p className="text-[0.7rem] font-medium text-muted-foreground">{stat.label}</p>
            <p className={cn(
              "mt-0.5 text-xl font-semibold tracking-tight text-foreground",
              "highlight" in stat && stat.highlight && "text-primary"
            )}>
              {stat.value}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Run list */}
      <motion.div variants={itemVariants} className="rounded-xl border border-border/40 bg-card/80">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">All runs</h2>
        </div>

        {loading ? (
          <div className="space-y-px">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse bg-muted/20" />
            ))}
          </div>
        ) : runs.length > 0 ? (
          <div className="divide-y divide-border/30">
            {runs.map((run, i) => {
              const isActive = ["pending", "initializing", "running"].includes(run.status);

              return (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                >
                  {/* Mobile layout */}
                  <div className="p-4 sm:hidden">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={cn("gap-1 text-[0.62rem] font-medium", statusColor(run.status))}
                      >
                        {statusIcon(run.status)}
                        {run.status}
                      </Badge>
                      {run.bestFitness != null && (
                        <span className="flex items-center gap-1 font-mono text-xs font-medium text-success">
                          <TrendingUp className="h-3 w-3" />
                          {(run.bestFitness * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>

                    <Link href={`/run/${run.id}`} className="mt-2 block">
                      <p className="text-sm font-medium text-foreground line-clamp-2">
                        {run.taskDescription}
                      </p>
                    </Link>

                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{run.config.modelId}</span>
                      <span>Gen {run.currentGeneration}/{run.config.generations}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(run.startedAt)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Link href={`/run/${run.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                            Open
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(run.id)}
                          disabled={deleting === run.id || isActive}
                        >
                          {deleting === run.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden items-center gap-4 px-5 py-3 sm:flex">
                    <Badge
                      variant="outline"
                      className={cn("w-[6rem] shrink-0 justify-center gap-1 text-[0.62rem] font-medium", statusColor(run.status))}
                    >
                      {statusIcon(run.status)}
                      {run.status}
                    </Badge>

                    <Link href={`/run/${run.id}`} className="min-w-0 flex-1 group">
                      <p className="truncate text-sm text-foreground group-hover:text-primary">
                        {run.taskDescription}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {run.config.provider} / {run.config.modelId} / {run.testCaseCount} test{run.testCaseCount !== 1 ? "s" : ""}
                      </p>
                    </Link>

                    <span className="shrink-0 text-center text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{run.currentGeneration}</span>
                      /{run.config.generations} gen
                    </span>

                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(run.startedAt)}
                    </span>

                    {run.bestFitness != null ? (
                      <span className="flex w-16 shrink-0 items-center justify-end gap-1 font-mono text-xs font-medium text-success">
                        <TrendingUp className="h-3 w-3" />
                        {(run.bestFitness * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">--</span>
                    )}

                    <div className="flex shrink-0 items-center gap-1">
                      <Link href={`/run/${run.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
                          Open
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(run.id)}
                        disabled={deleting === run.id || isActive}
                        aria-label={`Delete run ${run.id}`}
                      >
                        {deleting === run.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-5 pb-8 pt-4 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Dna className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">No runs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start your first evolution run.
            </p>
            <Link href="/new" className="mt-4">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                New Run
              </Button>
            </Link>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
