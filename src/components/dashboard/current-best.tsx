"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Copy, Check } from "lucide-react";
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
            Best Prompt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Waiting for first evaluation...
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt.text);
    setCopied(true);
    toast.success("Prompt copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Best Prompt
          </CardTitle>
          <div className="flex items-center gap-2">
            {prompt.fitness !== null && (
              <Badge variant="secondary">
                Fitness: {(prompt.fitness * 100).toFixed(1)}%
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/50 rounded-md p-3 max-h-60 overflow-y-auto">
          {prompt.text}
        </pre>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span>Generation {prompt.generation}</span>
          <span>Origin: {prompt.origin.type}</span>
        </div>
      </CardContent>
    </Card>
  );
}
