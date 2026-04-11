"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  History,
  Plus,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  StopCircle,
  Clock,
  Trash2,
} from "lucide-react";
import type { RunStatus } from "@/lib/engine/types";

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
  config: { generations: number; populationSize: number; provider: string; modelId: string };
  testCaseCount: number;
  bestPromptText: string | null;
}

function statusBadge(status: RunStatus) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
        </Badge>
      );
    case "running":
    case "initializing":
      return (
        <Badge variant="default" className="bg-blue-600">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running
        </Badge>
      );
    case "stopped":
      return (
        <Badge variant="secondary">
          <StopCircle className="h-3 w-3 mr-1" /> Stopped
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" /> Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <Clock className="h-3 w-3 mr-1" /> {status}
        </Badge>
      );
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
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
      await fetch(`/api/evolution/${id}`, { method: "DELETE" });
      setRuns((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Run History</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Browse past evolution runs and their results.
          </p>
        </div>
        <Link href="/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            New Run
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-1">No runs yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start your first evolution run to see results here.
            </p>
            <Link href="/new">
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Start First Run
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              {runs.length} run{runs.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="w-[80px] text-right">Fitness</TableHead>
                  <TableHead className="w-[70px] text-right hidden sm:table-cell">Gens</TableHead>
                  <TableHead className="w-[130px] hidden md:table-cell">Started</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <div className="font-medium text-sm">
                        {truncate(run.taskDescription, 60)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {run.config.provider} / {run.config.modelId} / {run.testCaseCount} test cases
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(run.status)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {run.bestFitness != null ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {(run.bestFitness * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground hidden sm:table-cell">
                      {run.currentGeneration}/{run.config.generations}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                      {formatDate(run.startedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/run/${run.id}`}>
                          <Button variant="ghost" size="sm">
                            View <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(run.id)}
                          disabled={deleting === run.id}
                        >
                          {deleting === run.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
