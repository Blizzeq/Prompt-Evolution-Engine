"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GitBranch, Copy, Check, Dna, Shuffle, Star, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Prompt, PromptOrigin } from "@/lib/engine/types";

// ─── Node data type ───

interface PromptNodeData {
  label: string;
  promptText: string;
  fitness: number;
  generation: number;
  origin: PromptOrigin;
  isBest: boolean;
  [key: string]: unknown;
}

// ─── Helpers ───

function originStyle(origin: PromptOrigin) {
  switch (origin.type) {
    case "seed": return { border: "border-blue-400/60", bg: "bg-blue-50 dark:bg-blue-950/30", accent: "#3b82f6", text: "text-blue-600 dark:text-blue-400" };
    case "crossover": return { border: "border-purple-400/60", bg: "bg-purple-50 dark:bg-purple-950/30", accent: "#a855f7", text: "text-purple-600 dark:text-purple-400" };
    case "mutation": return { border: "border-orange-400/60", bg: "bg-orange-50 dark:bg-orange-950/30", accent: "#f97316", text: "text-orange-600 dark:text-orange-400" };
    case "elite": return { border: "border-yellow-400/60", bg: "bg-yellow-50 dark:bg-yellow-950/30", accent: "#eab308", text: "text-yellow-600 dark:text-yellow-400" };
  }
}

function originIcon(origin: PromptOrigin) {
  const s = originStyle(origin);
  switch (origin.type) {
    case "seed": return <Sparkles className={cn("h-3 w-3", s.text)} />;
    case "crossover": return <Shuffle className={cn("h-3 w-3", s.text)} />;
    case "mutation": return <Dna className={cn("h-3 w-3", s.text)} />;
    case "elite": return <Star className={cn("h-3 w-3", s.text)} />;
  }
}

function originLabel(origin: PromptOrigin): string {
  switch (origin.type) {
    case "seed": return origin.source === "user" ? "User Seed" : "Generated";
    case "crossover": return "Crossover";
    case "mutation": {
      const mt = origin.mutationType.replace(/-/g, " ");
      return mt.charAt(0).toUpperCase() + mt.slice(1);
    }
    case "elite": return "Elite";
  }
}

function fitnessColor(fitness: number): string {
  if (fitness >= 0.9) return "text-green-600 dark:text-green-400";
  if (fitness >= 0.7) return "text-blue-600 dark:text-blue-400";
  if (fitness >= 0.4) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function fitnessBg(fitness: number): string {
  if (fitness >= 0.9) return "bg-green-500";
  if (fitness >= 0.7) return "bg-blue-500";
  if (fitness >= 0.4) return "bg-orange-500";
  return "bg-red-500";
}

function getParentIds(origin: PromptOrigin): string[] {
  switch (origin.type) {
    case "crossover": return origin.parents;
    case "mutation": return [origin.parent];
    case "elite": return [origin.originalId];
    default: return [];
  }
}

// ─── Custom Node Component ───

function PromptNode({ data }: NodeProps<Node<PromptNodeData>>) {
  const s = originStyle(data.origin);
  const preview = data.promptText.length > 80
    ? data.promptText.slice(0, 80) + "..."
    : data.promptText;

  return (
    <div
      className={cn(
        "rounded-xl border bg-background px-3.5 py-3 shadow-sm w-[240px] transition-all",
        "hover:shadow-md cursor-pointer select-none",
        s.border, s.bg,
        data.isBest && "ring-2 ring-green-500/70 ring-offset-2 ring-offset-background shadow-green-500/10",
      )}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !border-none !bg-muted-foreground/30" />

      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          {originIcon(data.origin)}
          <span className={cn("text-[10px] font-semibold uppercase tracking-wider", s.text)}>
            {originLabel(data.origin)}
          </span>
        </div>
        {data.isBest && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">
            Best
          </span>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2 mb-2.5 break-words">
        {preview}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/60">Gen {data.generation}</span>
        <div className="flex items-center gap-1.5">
          <div className={cn("h-1.5 rounded-full", fitnessBg(data.fitness))} style={{ width: `${Math.max(data.fitness * 40, 4)}px` }} />
          <span className={cn("text-xs font-semibold tabular-nums", fitnessColor(data.fitness))}>
            {(data.fitness * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !border-none !bg-muted-foreground/30" />
    </div>
  );
}

const nodeTypes = { prompt: PromptNode };

// ─── Dagre Layout (top-to-bottom) ───

const NODE_WIDTH = 240;
const NODE_HEIGHT = 100;

function layoutWithDagre(
  nodes: Node<PromptNodeData>[],
  edges: Edge[],
): { nodes: Node<PromptNodeData>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    nodesep: 40,
    ranksep: 60,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// ─── Flow Wrapper ───

function GenealogyFlowInner({
  prompts,
  onNodeClick,
}: {
  prompts: Prompt[];
  onNodeClick: (prompt: Prompt) => void;
}) {
  let bestId: string | null = null;
  let bestFitness = -1;
  for (const p of prompts) {
    if ((p.fitness ?? 0) > bestFitness) {
      bestFitness = p.fitness ?? 0;
      bestId = p.id;
    }
  }

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node<PromptNodeData>[] = prompts.map((p) => ({
      id: p.id,
      type: "prompt",
      position: { x: 0, y: 0 },
      data: {
        label: p.text.slice(0, 40),
        promptText: p.text,
        fitness: p.fitness ?? 0,
        generation: p.generation,
        origin: p.origin,
        isBest: p.id === bestId,
      },
    }));

    const edges: Edge[] = [];
    const edgeIds = new Set<string>();
    for (const p of prompts) {
      const parentIds = getParentIds(p.origin);
      for (const parentId of parentIds) {
        const edgeId = `${parentId}->${p.id}`;
        if (edgeIds.has(edgeId)) continue;
        if (!prompts.some((pp) => pp.id === parentId)) continue;
        edgeIds.add(edgeId);

        const isBestPath = p.id === bestId;
        const s = originStyle(p.origin);

        edges.push({
          id: edgeId,
          source: parentId,
          target: p.id,
          type: "smoothstep",
          animated: isBestPath,
          style: {
            stroke: isBestPath ? "#22c55e" : s.accent,
            strokeWidth: isBestPath ? 2.5 : 1.5,
            opacity: isBestPath ? 1 : 0.5,
          },
        });
      }
    }

    const laid = layoutWithDagre(nodes, edges);
    return { initialNodes: laid.nodes, initialEdges: laid.edges };
  }, [prompts, bestId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const prompt = prompts.find((p) => p.id === node.id);
      if (prompt) onNodeClick(prompt);
    },
    [prompts, onNodeClick],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.2}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={true}
    >
      <Background gap={20} size={1} color="var(--color-border)" style={{ opacity: 0.3 }} />
      <Controls showInteractive={false} className="!border-border !bg-card !shadow-sm [&>button]:!border-border [&>button]:!bg-card" />
    </ReactFlow>
  );
}

// ─── Main Export ───

export function GenealogyDag({ runId, currentGeneration }: { runId: string; currentGeneration?: number }) {
  const [prompts, setPrompts] = useState<Prompt[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const isInitial = prompts === null;
    if (isInitial) setLoading(true);
    fetch(`/api/evolution/${runId}`)
      .then((r) => r.json())
      .then((data) => setPrompts(data.prompts ?? []))
      .catch(() => { if (isInitial) setPrompts([]); })
      .finally(() => { if (isInitial) setLoading(false); });
  }, [runId, currentGeneration]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Prompt copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/80 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <GitBranch className="h-4 w-4" />
          Prompt Genealogy
        </div>
        <Skeleton className="mt-3 h-[500px] w-full rounded-lg" />
      </div>
    );
  }

  if (!prompts || prompts.length === 0) return null;

  const generations = new Set(prompts.map((p) => p.generation));

  return (
    <>
      <div className="rounded-xl border border-border/40 bg-card/80">
        <div className="flex flex-col gap-2 px-5 pt-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <GitBranch className="h-4 w-4" />
              Prompt Genealogy
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {prompts.length} prompts across {generations.size} generations. Click a node to inspect.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {([
              { label: "Seed", color: "bg-blue-500" },
              { label: "Crossover", color: "bg-purple-500" },
              { label: "Mutation", color: "bg-orange-500" },
              { label: "Elite", color: "bg-yellow-500" },
            ] as const).map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={cn("inline-block h-2 w-2 rounded-full", color)} />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="h-[600px] w-full border-t border-border/30">
          <ReactFlowProvider>
            <GenealogyFlowInner prompts={prompts} onNodeClick={setSelectedPrompt} />
          </ReactFlowProvider>
        </div>
      </div>

      <Dialog open={!!selectedPrompt} onOpenChange={(open) => !open && setSelectedPrompt(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedPrompt && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap text-base">
                  {originIcon(selectedPrompt.origin)}
                  {originLabel(selectedPrompt.origin)}
                  <Badge variant="secondary" className="text-xs">
                    Gen {selectedPrompt.generation}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", fitnessColor(selectedPrompt.fitness ?? 0))}
                  >
                    {((selectedPrompt.fitness ?? 0) * 100).toFixed(1)}%
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(selectedPrompt.text)}
                    className="gap-1.5"
                  >
                    {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                  </Button>
                </div>
                <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/50 rounded-lg p-4 leading-relaxed">
                  {selectedPrompt.text}
                </pre>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
