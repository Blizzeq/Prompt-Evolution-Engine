"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  GitBranch,
  History,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Target,
} from "lucide-react";
import type { RunStatus } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

interface RecentRun {
  id: string;
  taskDescription: string;
  status: RunStatus;
  bestFitness: number | null;
  startedAt: string;
}

const FEATURE_PILLARS = [
  {
    icon: BrainCircuit,
    title: "Search loop",
    description: "Generate and rank prompt variants across each generation.",
  },
  {
    icon: Target,
    title: "Scoring",
    description: "Evaluate candidates against tests and model-based review.",
  },
  {
    icon: ShieldCheck,
    title: "Run tracking",
    description: "Keep provider, status, and run health visible while work is in flight.",
  },
  {
    icon: GitBranch,
    title: "Lineage",
    description: "Inspect how the best prompt emerged from seeds, crossover, and mutation.",
  },
];

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

function statusColor(status: RunStatus) {
  switch (status) {
    case "completed":
      return "border-success/20 bg-success/10 text-success";
    case "running":
    case "initializing":
      return "border-primary/20 bg-primary/10 text-primary";
    case "failed":
      return "border-destructive/20 bg-destructive/10 text-destructive";
    default:
      return "border-white/12 bg-white/[0.06] text-muted-foreground dark:border-white/8 dark:bg-white/[0.04]";
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
  const [runs, setRuns] = useState<RecentRun[]>([]);

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((data) => setRuns(data.runs ?? []))
      .catch(() => {});
  }, []);

  const recentRuns = runs.slice(0, 4);
  const stats = useMemo(() => {
    const completed = runs.filter((run) => run.status === "completed").length;
    const active = runs.filter(
      (run) => run.status === "running" || run.status === "initializing"
    ).length;
    const fitnessValues = runs
      .map((run) => run.bestFitness)
      .filter((value): value is number => value != null);

    return {
      totalRuns: runs.length,
      completedRuns: completed,
      activeRuns: active,
      averageFitness:
        fitnessValues.length > 0
          ? (fitnessValues.reduce((sum, value) => sum + value, 0) /
              fitnessValues.length) *
            100
          : null,
      bestFitness:
        fitnessValues.length > 0 ? Math.max(...fitnessValues) * 100 : null,
    };
  }, [runs]);

  const latestRun = recentRuns[0] ?? null;

  return (
    <div className="space-y-6 lg:space-y-8">
      <motion.section
        className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_24rem]"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="panel-strong hero-gradient relative overflow-hidden rounded-[2rem] px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-11">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_60%)] lg:block" />
          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                <Sparkles className="h-3 w-3" />
                Local workspace
              </Badge>
              <Badge variant="secondary">Run overview</Badge>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-[2.35rem] font-semibold leading-[0.98] tracking-[-0.08em] text-foreground sm:text-[3.2rem] lg:text-[4.35rem]">
                Track runs, compare results, and reopen the best prompts.
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                The dashboard keeps recent activity, run health, and top outcomes in one place.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/new" className={cn(buttonVariants({ variant: "default", size: "lg" }), "w-full justify-center sm:w-auto")}> 
                <Plus className="h-4 w-4" />
                New Run
              </Link>
              <Link href="/history" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full justify-center sm:w-auto")}>
                <History className="h-4 w-4" />
                View History
              </Link>
            </div>

            <div className="grid gap-3 pt-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="panel-soft rounded-[1.4rem] p-4">
                <p className="section-kicker">Tracked runs</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                  {stats.totalRuns}
                </p>
              </div>
              <div className="panel-soft rounded-[1.4rem] p-4">
                <p className="section-kicker">Active now</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                  {stats.activeRuns}
                </p>
              </div>
              <div className="panel-soft rounded-[1.4rem] p-4">
                <p className="section-kicker">Average fitness</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                  {stats.averageFitness != null
                    ? `${stats.averageFitness.toFixed(1)}%`
                    : "--"}
                </p>
              </div>
              <div className="panel-soft rounded-[1.4rem] p-4">
                <p className="section-kicker">Peak result</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                  {stats.bestFitness != null ? `${stats.bestFitness.toFixed(1)}%` : "--"}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.aside variants={itemVariants} className="space-y-4">
          <div className="panel rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Workspace status</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
                  Local runtime ready
                </h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Activity className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
                <span>Response time</span>
                <span className="font-mono text-foreground">142ms</span>
              </div>
              <div className="flex items-center justify-between rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
                <span>Providers</span>
                <span className="font-medium text-foreground">Ollama + Cloud</span>
              </div>
              <div className="flex items-center justify-between rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
                <span>Storage</span>
                <span className="font-medium text-foreground">SQLite</span>
              </div>
            </div>
          </div>

          <div className="panel-grid panel rounded-[1.75rem] p-5 sm:p-6">
            <p className="section-kicker">Latest run</p>
            {latestRun ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline" className={statusColor(latestRun.status)}>
                    {latestRun.status}
                  </Badge>
                  {latestRun.bestFitness != null ? (
                    <span className="flex items-center gap-1 font-mono text-sm text-success">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {(latestRun.bestFitness * 100).toFixed(1)}%
                    </span>
                  ) : null}
                </div>
                <div>
                  <h3 className="line-clamp-2 text-lg font-semibold tracking-[-0.04em] text-foreground">
                    {latestRun.taskDescription}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatDate(latestRun.startedAt)}
                  </p>
                </div>
                <Link
                  href={`/run/${latestRun.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-center")}
                >
                  Open run
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/14 bg-white/[0.03] px-4 py-6 text-sm text-muted-foreground dark:border-white/8 dark:bg-white/[0.02]">
                No runs yet. Start a run to populate this panel.
              </div>
            )}
          </div>
        </motion.aside>
      </motion.section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]">
        <motion.div
          className="panel rounded-[1.75rem] p-5 sm:p-6"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45 }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">Recent runs</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                Latest activity
              </h2>
            </div>
            <Link href="/history" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "self-start sm:self-auto")}>
              Open history
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {recentRuns.length > 0 ? (
              recentRuns.map((run, index) => (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                >
                  <Link
                    href={`/run/${run.id}`}
                    className="group block rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-white/[0.07] dark:border-white/6 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={statusColor(run.status)}>
                            {run.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatDate(run.startedAt)}</span>
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm font-medium leading-relaxed text-foreground transition-colors group-hover:text-primary">
                          {run.taskDescription}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 sm:justify-end">
                        {run.bestFitness != null ? (
                          <div className="rounded-[1rem] border border-success/20 bg-success/10 px-3 py-2 text-right">
                            <p className="text-[0.62rem] uppercase tracking-[0.24em] text-success/80">
                              Fitness
                            </p>
                            <p className="mt-1 font-mono text-sm text-success">
                              {(run.bestFitness * 100).toFixed(1)}%
                            </p>
                          </div>
                        ) : null}
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-foreground transition-colors group-hover:border-primary/20 group-hover:text-primary dark:border-white/6 dark:bg-white/[0.03]">
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-white/14 bg-white/[0.03] px-5 py-8 text-sm text-muted-foreground dark:border-white/8 dark:bg-white/[0.02]">
                No runs yet. Start a run and it will appear here.
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          className="grid gap-4 sm:grid-cols-2"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-30px" }}
        >
          {FEATURE_PILLARS.map((feature) => (
            <motion.div key={feature.title} variants={itemVariants}>
              <Card className="h-full border-white/10 bg-white/[0.08] transition-transform duration-300 hover:-translate-y-1 hover:border-primary/18 dark:border-white/6 dark:bg-white/[0.04]">
                <CardContent className="flex h-full flex-col justify-between py-6">
                  <div>
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold tracking-[-0.04em] text-foreground">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
