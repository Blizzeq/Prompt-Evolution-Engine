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
import { Users, Sparkles } from "lucide-react";
import type { GenerationSummary } from "@/lib/engine/types";

interface PopulationTableProps {
  generationSummaries: GenerationSummary[];
  currentGeneration: number;
}

export function PopulationTable({
  generationSummaries,
  currentGeneration,
}: PopulationTableProps) {
  if (!generationSummaries.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            Generation Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 animate-pulse" />
            Waiting for first generation...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          Generation Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[70px]">Gen</TableHead>
                <TableHead>Best</TableHead>
                <TableHead>Mean</TableHead>
                <TableHead>Worst</TableHead>
                <TableHead className="w-[70px] text-center">Pop</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {generationSummaries.map((summary) => (
                <TableRow
                  key={summary.generation}
                  className={
                    summary.generation === currentGeneration
                      ? "bg-primary/5"
                      : undefined
                  }
                >
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="font-mono text-[11px] tabular-nums"
                    >
                      {summary.generation}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium font-mono text-sm text-success tabular-nums">
                    {(summary.bestFitness * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm tabular-nums">
                    {(summary.meanFitness * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm tabular-nums">
                    {(summary.worstFitness * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {summary.populationSize}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
