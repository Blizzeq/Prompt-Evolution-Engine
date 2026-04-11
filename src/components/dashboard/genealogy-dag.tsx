"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch } from "lucide-react";
import * as d3 from "d3";
import type { Prompt, PromptOrigin } from "@/lib/engine/types";

interface GenealogyDagProps {
  runId: string;
}

interface DagNode {
  id: string;
  generation: number;
  fitness: number;
  origin: PromptOrigin;
  text: string;
  x: number;
  y: number;
}

interface DagEdge {
  source: string;
  target: string;
}

function originColor(origin: PromptOrigin): string {
  switch (origin.type) {
    case "seed":
      return "hsl(210, 70%, 55%)";
    case "crossover":
      return "hsl(270, 60%, 55%)";
    case "mutation":
      return "hsl(30, 80%, 55%)";
    case "elite":
      return "hsl(45, 90%, 50%)";
  }
}

function originLabel(origin: PromptOrigin): string {
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

function getParentIds(origin: PromptOrigin): string[] {
  switch (origin.type) {
    case "crossover":
      return origin.parents;
    case "mutation":
      return [origin.parent];
    case "elite":
      return [origin.originalId];
    default:
      return [];
  }
}

export function GenealogyDag({ runId }: GenealogyDagProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [prompts, setPrompts] = useState<Prompt[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/evolution/${runId}`)
      .then((r) => r.json())
      .then((data) => {
        setPrompts(data.prompts ?? []);
      })
      .catch(() => setPrompts([]))
      .finally(() => setLoading(false));
  }, [runId]);

  const renderDag = useCallback(() => {
    if (!prompts || prompts.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = svgRef.current.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const generations = new Map<number, Prompt[]>();
    for (const p of prompts) {
      if (!generations.has(p.generation)) generations.set(p.generation, []);
      generations.get(p.generation)!.push(p);
    }

    const genNumbers = Array.from(generations.keys()).sort((a, b) => a - b);
    const maxPerGen = Math.max(...Array.from(generations.values()).map((g) => g.length));

    const marginX = 60;
    const marginY = 40;
    const nodeRadius = 10;
    const colWidth = Math.max(80, (width - marginX * 2) / Math.max(genNumbers.length - 1, 1));
    const rowHeight = Math.max(40, 300 / Math.max(maxPerGen - 1, 1));
    const height = maxPerGen * rowHeight + marginY * 2;

    svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    // Layout nodes
    const nodeMap = new Map<string, DagNode>();
    for (const gen of genNumbers) {
      const genPrompts = generations.get(gen)!;
      // Sort by fitness descending so best is on top
      genPrompts.sort((a, b) => (b.fitness ?? 0) - (a.fitness ?? 0));
      const genIdx = genNumbers.indexOf(gen);
      const x = marginX + genIdx * colWidth;

      for (let i = 0; i < genPrompts.length; i++) {
        const p = genPrompts[i];
        const y = marginY + i * rowHeight + (maxPerGen - genPrompts.length) * rowHeight / 2;
        nodeMap.set(p.id, {
          id: p.id,
          generation: p.generation,
          fitness: p.fitness ?? 0,
          origin: p.origin,
          text: p.text,
          x,
          y,
        });
      }
    }

    // Build edges
    const edges: DagEdge[] = [];
    for (const p of prompts) {
      const parentIds = getParentIds(p.origin);
      for (const parentId of parentIds) {
        if (nodeMap.has(parentId)) {
          edges.push({ source: parentId, target: p.id });
        }
      }
    }

    // Draw edges
    const linkGen = d3
      .linkHorizontal<DagEdge, DagNode>()
      .source((d) => nodeMap.get(d.source)!)
      .target((d) => nodeMap.get(d.target)!)
      .x((d) => d.x)
      .y((d) => d.y);

    svg
      .append("g")
      .attr("class", "edges")
      .selectAll("path")
      .data(edges)
      .join("path")
      .attr("d", (d) => linkGen(d))
      .attr("fill", "none")
      .attr("stroke", "hsl(var(--muted-foreground))")
      .attr("stroke-opacity", 0.3)
      .attr("stroke-width", 1.5);

    // Generation labels
    svg
      .append("g")
      .attr("class", "gen-labels")
      .selectAll("text")
      .data(genNumbers)
      .join("text")
      .attr("x", (_d, i) => marginX + i * colWidth)
      .attr("y", 16)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "hsl(var(--muted-foreground))")
      .text((d) => `Gen ${d}`);

    // Draw nodes
    const nodes = Array.from(nodeMap.values());

    const nodeGroup = svg
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("cursor", "pointer");

    // Node circles
    nodeGroup
      .append("circle")
      .attr("r", (d) => nodeRadius * (0.6 + d.fitness * 0.8))
      .attr("fill", (d) => originColor(d.origin))
      .attr("stroke", "hsl(var(--background))")
      .attr("stroke-width", 2)
      .attr("opacity", 0.85);

    // Tooltip
    const tooltip = d3.select(tooltipRef.current);

    nodeGroup
      .on("mouseenter", (_event, d) => {
        tooltip
          .style("opacity", "1")
          .style("pointer-events", "auto")
          .html(
            `<div class="font-medium text-xs mb-1">${originLabel(d.origin)}</div>` +
              `<div class="text-xs text-muted-foreground mb-1">Gen ${d.generation} | Fitness: ${(d.fitness * 100).toFixed(1)}%</div>` +
              `<div class="text-xs font-mono max-w-[250px] truncate">${d.text.slice(0, 120)}${d.text.length > 120 ? "..." : ""}</div>`,
          );
      })
      .on("mousemove", (event) => {
        const svgRect = svgRef.current!.getBoundingClientRect();
        const x = event.clientX - svgRect.left;
        const y = event.clientY - svgRect.top;
        tooltip.style("left", `${x + 12}px`).style("top", `${y - 10}px`);
      })
      .on("mouseleave", () => {
        tooltip.style("opacity", "0").style("pointer-events", "none");
      });
  }, [prompts]);

  useEffect(() => {
    renderDag();

    const handleResize = () => renderDag();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderDag]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4" />
            Prompt Genealogy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!prompts || prompts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4" />
          Prompt Genealogy
        </CardTitle>
        <div className="flex flex-wrap gap-3 mt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: "hsl(210, 70%, 55%)" }}
            />
            Seed
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: "hsl(270, 60%, 55%)" }}
            />
            Crossover
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: "hsl(30, 80%, 55%)" }}
            />
            Mutation
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: "hsl(45, 90%, 50%)" }}
            />
            Elite
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-x-auto">
          <svg ref={svgRef} className="w-full" />
          <div
            ref={tooltipRef}
            className="absolute bg-popover border rounded-md shadow-md p-2 opacity-0 pointer-events-none transition-opacity z-50"
            style={{ maxWidth: 280 }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
