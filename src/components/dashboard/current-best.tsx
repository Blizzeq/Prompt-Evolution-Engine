"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Copy, Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Prompt } from "@/lib/engine/types";

interface CurrentBestProps {
  prompt: Prompt | null;
}

export function CurrentBest({ prompt }: CurrentBestProps) {
  const [copied, setCopied] = useState(false);

  if (!prompt) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" />
            Best prompt so far
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 animate-pulse" />
            Waiting for the first scored candidate...
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt.text);
    setCopied(true);
    toast.success("Prompt copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10">
              <Trophy className="h-3.5 w-3.5 text-warning" />
            </div>
            Best prompt so far
          </CardTitle>
          <div className="flex items-center gap-2">
            {prompt.fitness !== null && (
              <Badge
                variant="outline"
                className="bg-success/10 text-success border-success/20 text-xs font-mono"
              >
                {(prompt.fitness * 100).toFixed(1)}%
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/40 rounded-xl p-4 max-h-60 overflow-y-auto border border-border/50 leading-relaxed">
          {prompt.text}
        </pre>
        <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
          <span className="bg-muted rounded-md px-2 py-0.5">
            Gen {prompt.generation}
          </span>
          <span className="bg-muted rounded-md px-2 py-0.5">
            {prompt.origin.type}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
