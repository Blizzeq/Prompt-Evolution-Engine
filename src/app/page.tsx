"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dna,
  Plus,
  History,
  ArrowRight,
  Sparkles,
  GitBranch,
  Target,
  Zap,
} from "lucide-react";
import type { RunStatus } from "@/lib/engine/types";

interface RecentRun {
  id: string;
  taskDescription: string;
  status: RunStatus;
  bestFitness: number | null;
  startedAt: string;
}

const FEATURES = [
  {
    icon: Dna,
    title: "Genetic Algorithms",
    description: "GA & Differential Evolution optimize your prompts through selection, crossover, and mutation.",
  },
  {
    icon: Target,
    title: "LLM-as-Judge",
    description: "Automated fitness evaluation using LLM judges against your test cases.",
  },
  {
    icon: GitBranch,
    title: "7 Mutation Types",
    description: "Rephrase, add constraints, tone shift, add examples, and more.",
  },
  {
    icon: Zap,
    title: "Local-First",
    description: "Run with Ollama locally or connect to Google AI Studio / OpenRouter.",
  },
];

export default function Home() {
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((data) => setRecentRuns((data.runs ?? []).slice(0, 3)))
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-8">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Powered by evolutionary algorithms
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Prompt Evolution Engine
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Automatically optimize your LLM prompts using genetic algorithms.
          Define a task, provide test cases, and let evolution find the best prompt.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/new">
            <Button size="lg">
              <Plus className="h-4 w-4 mr-2" />
              New Evolution Run
            </Button>
          </Link>
          <Link href="/history">
            <Button variant="outline" size="lg">
              <History className="h-4 w-4 mr-2" />
              View History
            </Button>
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="bg-muted/30">
            <CardContent className="pt-6">
              <feature.icon className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent runs */}
      {recentRuns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Runs</h2>
            <Link href="/history">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid gap-2">
            {recentRuns.map((run) => (
              <Link key={run.id} href={`/run/${run.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {run.taskDescription}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(run.startedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {run.bestFitness != null && (
                        <span className="text-sm font-mono text-green-600 dark:text-green-400">
                          {(run.bestFitness * 100).toFixed(1)}%
                        </span>
                      )}
                      <Badge
                        variant={
                          run.status === "completed"
                            ? "default"
                            : run.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-xs"
                      >
                        {run.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
