"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Trophy,
  TrendingUp,
  Clock,
  Zap,
  Copy,
  Check,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { RunSummary } from "@/lib/engine/types";

interface RunResultsProps {
  summary: RunSummary;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function RunResults({ summary }: RunResultsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summary.bestPrompt.text);
    setCopied(true);
    toast.success("Winning prompt copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-green-500/20 bg-green-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Evolution Complete
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {(summary.finalBestFitness * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Final Fitness</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold flex items-center justify-center gap-1">
              {summary.improvementPercent > 0 ? "+" : ""}
              {summary.improvementPercent.toFixed(1)}%
              {summary.improvementPercent > 0 && (
                <TrendingUp className="h-4 w-4 text-green-500" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">Improvement</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold flex items-center justify-center gap-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {formatDuration(summary.totalDurationMs)}
            </div>
            <div className="text-xs text-muted-foreground">Duration</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold flex items-center justify-center gap-1">
              <Zap className="h-4 w-4 text-muted-foreground" />
              {summary.totalApiCalls}
            </div>
            <div className="text-xs text-muted-foreground">API Calls</div>
          </div>
        </div>

        <Separator />

        {/* Fitness comparison */}
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <Badge variant="secondary">Seed Best</Badge>
            <div className="mt-1 font-mono">
              {(summary.seedBestFitness * 100).toFixed(1)}%
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="text-center">
            <Badge variant="default">Final Best</Badge>
            <div className="mt-1 font-mono font-bold text-green-600 dark:text-green-400">
              {(summary.finalBestFitness * 100).toFixed(1)}%
            </div>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            {summary.totalGenerations} generations |{" "}
            {summary.convergenceGeneration
              ? `converged at gen ${summary.convergenceGeneration}`
              : "no convergence"}
          </span>
        </div>

        <Separator />

        {/* Winning prompt */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Winning Prompt</h4>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                </>
              )}
            </Button>
          </div>
          <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/50 rounded-md p-4 max-h-80 overflow-y-auto">
            {summary.bestPrompt.text}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
