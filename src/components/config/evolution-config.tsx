"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import type {
  EvalMethod,
  CrossoverStrategy,
  MutationType,
} from "@/lib/engine/types";

function sliderVal(v: number | readonly number[]): number {
  return Array.isArray(v) ? v[0] : (v as number);
}

export interface EvolutionConfigValues {
  populationSize: number;
  generations: number;
  mutationRate: number;
  eliteCount: number;
  eaVariant: "ga" | "de";
  evalMethod: EvalMethod;
  crossoverStrategy: CrossoverStrategy;
  mutationStrategies: MutationType[];
  fitnessThreshold: number;
  earlyStopGenerations: number;
  batchTestCases: boolean;
}

interface EvolutionConfigProps {
  values: EvolutionConfigValues;
  onChange: (values: EvolutionConfigValues) => void;
}

const ALL_MUTATION_STRATEGIES: MutationType[] = [
  "rephrase",
  "add-constraint",
  "remove-constraint",
  "reorder",
  "tone-shift",
  "add-example",
  "meta-mutation",
];

function HelpTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="cursor-help">
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function EvolutionConfig({ values, onChange }: EvolutionConfigProps) {
  const update = (partial: Partial<EvolutionConfigValues>) =>
    onChange({ ...values, ...partial });

  const toggleMutationStrategy = (strategy: MutationType) => {
    const current = values.mutationStrategies;
    if (current.includes(strategy)) {
      if (current.length <= 1) return; // need at least one
      update({ mutationStrategies: current.filter((s) => s !== strategy) });
    } else {
      update({ mutationStrategies: [...current, strategy] });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Evolution Parameters</h2>
        <p className="text-sm text-muted-foreground">
          Fine-tune the evolutionary algorithm
        </p>
      </div>

      {/* Core Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Population Size */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label>Population Size: {values.populationSize}</Label>
            <HelpTip text="Number of prompts per generation. Higher = more diversity but slower." />
          </div>
          <Slider
            min={4}
            max={16}
            step={1}
            value={[values.populationSize]}
            onValueChange={(v) => update({ populationSize: sliderVal(v) })}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>4 (fast)</span>
            <span>16 (diverse)</span>
          </div>
        </div>

        {/* Generations */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label>Generations: {values.generations}</Label>
            <HelpTip text="Number of evolution cycles. More generations = more refinement." />
          </div>
          <Slider
            min={3}
            max={30}
            step={1}
            value={[values.generations]}
            onValueChange={(v) => update({ generations: sliderVal(v) })}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>3 (quick)</span>
            <span>30 (thorough)</span>
          </div>
        </div>

        {/* Mutation Rate */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label>Mutation Rate: {(values.mutationRate * 100).toFixed(0)}%</Label>
            <HelpTip text="Probability of mutating vs crossover. Higher = more exploration." />
          </div>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[values.mutationRate * 100]}
            onValueChange={(v) => update({ mutationRate: sliderVal(v) / 100 })}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0% (crossover only)</span>
            <span>100% (mutation only)</span>
          </div>
        </div>

        {/* Elite Count */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label>Elite Count: {values.eliteCount}</Label>
            <HelpTip text="Top N prompts that survive unchanged to the next generation." />
          </div>
          <Slider
            min={1}
            max={Math.min(4, values.populationSize - 1)}
            step={1}
            value={[values.eliteCount]}
            onValueChange={(v) => update({ eliteCount: sliderVal(v) })}
          />
        </div>
      </div>

      {/* Strategy Selects */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Eval Method */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label>Evaluation Method</Label>
            <HelpTip text="How prompt responses are scored against expected outputs." />
          </div>
          <Select
            value={values.evalMethod}
            onValueChange={(v) => update({ evalMethod: v as EvalMethod })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="llm-judge">LLM Judge</SelectItem>
              <SelectItem value="exact-match">Exact Match</SelectItem>
              <SelectItem value="contains">Contains</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Crossover Strategy */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label>Crossover Strategy</Label>
            <HelpTip text="How two parent prompts are combined to create offspring." />
          </div>
          <Select
            value={values.crossoverStrategy}
            onValueChange={(v) =>
              update({ crossoverStrategy: v as CrossoverStrategy })
            }
            disabled={values.eaVariant === "de"}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simple">Simple</SelectItem>
              <SelectItem value="section-aware">Section-Aware</SelectItem>
              <SelectItem value="differential">Differential</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Advanced */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Advanced</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Early Stop */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Early Stop: {values.earlyStopGenerations} gens</Label>
              <HelpTip text="Stop if no fitness improvement for N consecutive generations." />
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[values.earlyStopGenerations]}
              onValueChange={(v) => update({ earlyStopGenerations: sliderVal(v) })}
            />
          </div>

          {/* Fitness Threshold */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>
                  Target Fitness: {(values.fitnessThreshold * 100).toFixed(0)}%
              </Label>
                <HelpTip text="Stop early once the best prompt reaches this score." />
            </div>
            <Slider
                min={70}
                max={100}
              step={5}
              value={[values.fitnessThreshold * 100]}
              onValueChange={(v) => update({ fitnessThreshold: sliderVal(v) / 100 })}
            />
          </div>
        </div>

        {/* Batch Test Cases */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label>Batch Test Cases</Label>
            <p className="text-xs text-muted-foreground">
              Judge all test cases in a single LLM call (faster, fewer API
              calls)
            </p>
          </div>
          <Switch
            checked={values.batchTestCases}
            onCheckedChange={(v) => update({ batchTestCases: v })}
          />
        </div>

        {/* Mutation Strategies */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label>Mutation Strategies</Label>
            <HelpTip text="Which mutation types are available. At least one must be selected." />
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_MUTATION_STRATEGIES.map((strategy) => {
              const isActive = values.mutationStrategies.includes(strategy);
              return (
                <button
                  key={strategy}
                  type="button"
                  onClick={() => toggleMutationStrategy(strategy)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {strategy}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
