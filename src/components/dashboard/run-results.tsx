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
    toast.success("Best prompt copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-success/20 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-success via-success/60 to-primary/40" />
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
            <Trophy className="h-4 w-4 text-warning" />
          </div>
          Run complete
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Best score",
              value: `${(summary.finalBestFitness * 100).toFixed(1)}%`,
              className: "text-success font-bold",
            },
            {
              label: "Improvement",
              value: `${summary.improvementPercent > 0 ? "+" : ""}${summary.improvementPercent.toFixed(1)}%`,
              icon: summary.improvementPercent > 0 ? TrendingUp : undefined,
              className:
                summary.improvementPercent > 0
                  ? "text-success font-bold"
                  : "font-bold",
            },
            {
              label: "Duration",
              value: formatDuration(summary.totalDurationMs),
              icon: Clock,
              className: "font-bold",
            },
            {
              label: "API Calls",
              value: String(summary.totalApiCalls),
              icon: Zap,
              className: "font-bold",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="text-center rounded-xl bg-muted/50 p-3"
            >
              <div
                className={`text-xl flex items-center justify-center gap-1 ${stat.className}`}
              >
                {stat.icon && (
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                )}
                {stat.value}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div className="text-center">
            <Badge variant="secondary" className="text-[11px]">
              Start
            </Badge>
            <div className="mt-1 font-mono text-sm">
              {(summary.seedBestFitness * 100).toFixed(1)}%
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="text-center">
            <Badge className="text-[11px]">Final Best</Badge>
            <div className="mt-1 font-mono text-sm font-bold text-success">
              {(summary.finalBestFitness * 100).toFixed(1)}%
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground ml-auto">
            {summary.totalGenerations} generations |{" "}
            {summary.convergenceGeneration
              ? `converged at gen ${summary.convergenceGeneration}`
              : "completed full run"}
          </span>
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">Best prompt</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5 text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy Prompt
                </>
              )}
            </Button>
          </div>
          <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/40 rounded-xl p-4 max-h-80 overflow-y-auto border border-border/50 leading-relaxed">
            {summary.bestPrompt.text}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
