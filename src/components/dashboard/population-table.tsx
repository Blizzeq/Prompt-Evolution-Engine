"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import type { GenerationSummary, Prompt } from "@/lib/engine/types";

interface PopulationTableProps {
  generationSummaries: GenerationSummary[];
  currentGeneration: number;
}

function originLabel(origin: Prompt["origin"]): string {
  switch (origin.type) {
    case "seed":
      return origin.source === "user" ? "User seed" : "Generated";
    case "crossover":
      return `Crossover (${origin.strategy})`;
    case "mutation":
      return `Mutation (${origin.mutationType})`;
    case "elite":
      return "Elite";
  }
}

export function PopulationTable({
  generationSummaries,
  currentGeneration,
}: PopulationTableProps) {
  // Show the latest completed generation's best prompt info
  const latestSummary = generationSummaries[generationSummaries.length - 1];

  if (!latestSummary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Generation Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Waiting for first generation...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Generation Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Gen</TableHead>
              <TableHead>Best Fitness</TableHead>
              <TableHead>Mean</TableHead>
              <TableHead>Worst</TableHead>
              <TableHead className="w-[80px]">Pop Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {generationSummaries.map((summary) => (
              <TableRow
                key={summary.generation}
                className={
                  summary.generation === currentGeneration
                    ? "bg-muted/50"
                    : undefined
                }
              >
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {summary.generation}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-green-600 dark:text-green-400">
                  {(summary.bestFitness * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {(summary.meanFitness * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {(summary.worstFitness * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="text-center">
                  {summary.populationSize}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
