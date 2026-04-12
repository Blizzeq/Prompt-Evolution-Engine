"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function originBg(origin: PromptOrigin): string {
  switch (origin.type) {
    case "seed": return "border-blue-400 bg-blue-50 dark:bg-blue-950/40";
    case "crossover": return "border-purple-400 bg-purple-50 dark:bg-purple-950/40";
    case "mutation": return "border-orange-400 bg-orange-50 dark:bg-orange-950/40";
    case "elite": return "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/40";
  }
}

function originMiniMapColor(origin: PromptOrigin): string {
  switch (origin.type) {
    case "seed": return "#3b82f6";
    case "crossover": return "#a855f7";
    case "mutation": return "#f97316";
    case "elite": return "#eab308";
  }
}

function originIcon(origin: PromptOrigin) {
  switch (origin.type) {
    case "seed": return <Sparkles className="h-3 w-3 text-blue-500" />;
    case "crossover": return <Shuffle className="h-3 w-3 text-purple-500" />;
    case "mutation": return <Dna className="h-3 w-3 text-orange-500" />;
    case "elite": return <Star className="h-3 w-3 text-yellow-500" />;
  }
}

function originLabel(origin: PromptOrigin): string {
  switch (origin.type) {
    case "seed": return origin.source === "user" ? "User Seed" : "Generated";
    case "crossover": return `Crossover`;
    case "mutation": {
      const mt = origin.mutationType.replace(/-/g, " ");
      return `Mutation (${mt})`;
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
  const preview = data.promptText.length > 100
    ? data.promptText.slice(0, 100) + "..."
    : data.promptText;

  return (
    <div
      className={`
        rounded-lg border-2 px-3 py-2 shadow-sm w-[200px] transition-shadow
        hover:shadow-md cursor-pointer select-none
        ${originBg(data.origin)}
        ${data.isBest ? "ring-2 ring-green-500 ring-offset-1 ring-offset-background" : ""}
      `}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-muted-foreground/40" />

      <div className="flex items-center gap-1.5 mb-1">
        {originIcon(data.origin)}
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
          {originLabel(data.origin)}
        </span>
        {data.isBest && (
          <Badge className="text-[9px] px-1 py-0 h-3.5 bg-green-500 text-white ml-auto">
            Best
          </Badge>
        )}
      </div>

      <p className="text-[11px] leading-snug font-mono opacity-60 line-clamp-3 mb-1.5 break-words">
        {preview}
      </p>

      <div className={`text-xs font-bold ${fitnessColor(data.fitness)}`}>
        {(data.fitness * 100).toFixed(1)}%
      </div>

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-muted-foreground/40" />
    </div>
  );
}

const nodeTypes = { prompt: PromptNode };

// ─── Dagre Layout ───

const NODE_WIDTH = 200;
const NODE_HEIGHT = 110;

function layoutWithDagre(
  nodes: Node<PromptNodeData>[],
  edges: Edge[],
): { nodes: Node<PromptNodeData>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "LR",
    nodesep: 30,
    ranksep: 80,
    marginx: 20,
    marginy: 20,
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

// ─── Flow Wrapper (needs ReactFlowProvider) ───

function GenealogyFlowInner({
  prompts,
  onNodeClick,
}: {
  prompts: Prompt[];
  onNodeClick: (prompt: Prompt) => void;
}) {
  // Find best prompt
  let bestId: string | null = null;
  let bestFitness = -1;
  for (const p of prompts) {
    if ((p.fitness ?? 0) > bestFitness) {
      bestFitness = p.fitness ?? 0;
      bestId = p.id;
    }
  }

  // Build nodes and edges
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
        // Skip duplicates and edges to non-existent parents
        if (edgeIds.has(edgeId)) continue;
        if (!prompts.some((pp) => pp.id === parentId)) continue;
        edgeIds.add(edgeId);
        edges.push({
          id: edgeId,
          source: parentId,
          target: p.id,
          type: "smoothstep",
          animated: p.id === bestId,
          style: {
            stroke: p.id === bestId ? "#22c55e" : "#94a3b8",
            strokeWidth: p.id === bestId ? 2 : 1,
          },
        });
      }
    }

    const laid = layoutWithDagre(nodes, edges);
    return { initialNodes: laid.nodes, initialEdges: laid.edges };
  }, [prompts, bestId]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

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
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.3}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={true}
    >
      <Background gap={16} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={(node) => {
          const data = node.data as PromptNodeData;
          return originMiniMapColor(data.origin);
        }}
        maskColor="rgba(0,0,0,0.1)"
        className="!bg-background !border-border"
      />
    </ReactFlow>
  );
}

// ─── Main Export ───

export function GenealogyDag({ runId }: { runId: string }) {
  const [prompts, setPrompts] = useState<Prompt[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/evolution/${runId}`)
      .then((r) => r.json())
      .then((data) => setPrompts(data.prompts ?? []))
      .catch(() => setPrompts([]))
      .finally(() => setLoading(false));
  }, [runId]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Prompt copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

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
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!prompts || prompts.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4" />
              Prompt Genealogy
            </CardTitle>
            <div className="flex flex-wrap gap-3">
              {[
                { label: "Seed", color: "bg-blue-500", icon: <Sparkles className="h-3 w-3" /> },
                { label: "Crossover", color: "bg-purple-500", icon: <Shuffle className="h-3 w-3" /> },
                { label: "Mutation", color: "bg-orange-500", icon: <Dna className="h-3 w-3" /> },
                { label: "Elite", color: "bg-yellow-500", icon: <Star className="h-3 w-3" /> },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
                  {label}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Select a node to inspect the prompt. Drag to pan. Scroll to zoom.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[500px] w-full">
            <ReactFlowProvider>
              <GenealogyFlowInner prompts={prompts} onNodeClick={setSelectedPrompt} />
            </ReactFlowProvider>
          </div>
        </CardContent>
      </Card>

      {/* Full prompt dialog */}
      <Dialog open={!!selectedPrompt} onOpenChange={(open) => !open && setSelectedPrompt(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedPrompt && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {originIcon(selectedPrompt.origin)}
                  {originLabel(selectedPrompt.origin)}
                  <Badge variant="secondary" className="ml-1">
                    Gen {selectedPrompt.generation}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={fitnessColor(selectedPrompt.fitness ?? 0)}
                  >
                    Fitness: {((selectedPrompt.fitness ?? 0) * 100).toFixed(1)}%
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(selectedPrompt.text)}
                  >
                    {copied ? (
                      <><Check className="h-3.5 w-3.5 mr-1" /> Copied</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
                    )}
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
