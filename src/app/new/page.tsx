"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { PresetSelector } from "@/components/config/preset-selector";
import { TaskInput } from "@/components/config/task-input";
import {
  TestCaseEditor,
  type TestCaseRow,
} from "@/components/config/test-case-editor";
import {
  EvolutionConfig,
  type EvolutionConfigValues,
} from "@/components/config/evolution-config";
import { SeedPrompts } from "@/components/config/seed-prompts";
import {
  ProviderSelector,
  type ProviderConfig,
} from "@/components/config/provider-selector";
import { Loader2, Play, Sparkles, Settings2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { TaskPreset, MutationType } from "@/lib/engine/types";

const ALL_MUTATION_STRATEGIES: MutationType[] = [
  "rephrase",
  "add-constraint",
  "remove-constraint",
  "reorder",
  "tone-shift",
  "add-example",
  "meta-mutation",
];

const DEFAULT_CONFIG: EvolutionConfigValues = {
  populationSize: 6,
  generations: 5,
  mutationRate: 0.3,
  eliteCount: 2,
  eaVariant: "ga",
  evalMethod: "llm-judge",
  crossoverStrategy: "simple",
  mutationStrategies: [...ALL_MUTATION_STRATEGIES],
  fitnessThreshold: 0.99,
  earlyStopGenerations: 3,
  batchTestCases: true,
};

const DEFAULT_PROVIDER: ProviderConfig = {
  provider: "ollama",
  modelId: "gemma4",
  apiKey: "",
  ollamaBaseUrl: "http://localhost:11434",
  delayBetweenCalls: 0,
  ollamaComputeMode: "auto",
  ollamaNumGpuLayers: 30,
};

/**
 * Estimate total API calls for a run.
 * Cloud providers use combined eval (1 call/prompt), Ollama uses full eval (N+1 calls/prompt).
 */
function estimateApiCalls(popSize: number, generations: number, providerType: string): number {
  const isCloud = providerType !== "ollama";
  const eliteCount = 2;
  const testCaseCount = 5; // typical auto-generated count

  // Seed generation + test case generation
  let calls = 2;

  // Gen 0: evaluate entire initial population
  const evalCallsPerPrompt = isCloud ? 1 : (testCaseCount + 1); // combined vs full
  calls += popSize * evalCallsPerPrompt;

  // Subsequent generations: create offspring + evaluate them
  const offspringPerGen = popSize - eliteCount;
  for (let g = 1; g < generations; g++) {
    calls += offspringPerGen; // crossover/mutation calls
    calls += offspringPerGen * evalCallsPerPrompt; // evaluation calls
  }

  return calls;
}

type Mode = "quick" | "advanced";

export default function NewRunPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("quick");

  // Quick mode state
  const [userPrompt, setUserPrompt] = useState("");
  const [context, setContext] = useState("");
  const [quickGenerations, setQuickGenerations] = useState(5);
  const [quickPopulationSize, setQuickPopulationSize] = useState(6);

  // Advanced mode state
  const [presets, setPresets] = useState<TaskPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [taskDescription, setTaskDescription] = useState("");
  const [testCases, setTestCases] = useState<TestCaseRow[]>([
    { input: "", expectedOutput: "", weight: 1.0 },
    { input: "", expectedOutput: "", weight: 1.0 },
    { input: "", expectedOutput: "", weight: 1.0 },
  ]);
  const [seedPrompts, setSeedPrompts] = useState<string[]>([]);
  const [config, setConfig] = useState<EvolutionConfigValues>(DEFAULT_CONFIG);

  // Shared
  const [provider, setProvider] = useState<ProviderConfig>(DEFAULT_PROVIDER);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/presets")
      .then((r) => r.json())
      .then((data) => setPresets(data.presets ?? []))
      .catch(() => toast.error("Failed to load presets"));
  }, []);

  const handlePresetSelect = (preset: TaskPreset) => {
    setSelectedPresetId(preset.id);
    setTaskDescription(preset.taskDescription);
    setTestCases(
      preset.testCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        weight: tc.weight,
      })),
    );
    setSeedPrompts(preset.seedPrompts ?? []);

    if (preset.suggestedConfig) {
      setConfig((prev) => ({
        ...prev,
        ...preset.suggestedConfig,
      }));
    }

    setErrors({});
  };

  const validateQuick = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (userPrompt.length < 5) {
      newErrors.prompt = "Enter a prompt to optimize (at least 5 characters)";
    }
    if (context.length < 10) {
      newErrors.context =
        "Describe what the prompt should do (at least 10 characters)";
    }

    if (provider.provider !== "ollama" && !provider.apiKey.trim()) {
      newErrors.provider = "API key is required for cloud providers";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateAdvanced = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (taskDescription.length < 10) {
      newErrors.task = "Task description must be at least 10 characters";
    }
    if (taskDescription.length > 2000) {
      newErrors.task = "Task description must be at most 2000 characters";
    }

    const validTestCases = testCases.filter(
      (tc) => tc.input.trim() && tc.expectedOutput.trim(),
    );
    if (validTestCases.length < 3) {
      newErrors.testCases =
        "At least 3 complete test cases required (input + expected output)";
    }

    const nonEmptySeeds = seedPrompts.filter((s) => s.trim());
    for (const seed of nonEmptySeeds) {
      if (!seed.includes("{input}")) {
        newErrors.seeds = "All seed prompts must contain {input} placeholder";
        break;
      }
    }

    if (provider.provider !== "ollama" && !provider.apiKey.trim()) {
      newErrors.provider = "API key is required for cloud providers";
    }

    if (config.eliteCount >= config.populationSize) {
      newErrors.config = "Elite count must be less than population size";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (mode === "quick" && !validateQuick()) {
      toast.error("Please fix validation errors");
      return;
    }
    if (mode === "advanced" && !validateAdvanced()) {
      toast.error("Please fix validation errors before starting");
      return;
    }

    setSubmitting(true);

    try {
      let body: Record<string, unknown>;

      if (mode === "quick") {
        body = {
          mode: "quick",
          userPrompt,
          context,
          taskDescription: context,
          testCases: [],
          config: {
            ...config,
            populationSize: quickPopulationSize,
            generations: quickGenerations,
            ...provider,
          },
        };
      } else {
        const validTestCases = testCases.filter(
          (tc) => tc.input.trim() && tc.expectedOutput.trim(),
        );
        const nonEmptySeeds = seedPrompts.filter((s) => s.trim());

        body = {
          mode: "advanced",
          taskDescription,
          testCases: validTestCases,
          seedPrompts: nonEmptySeeds.length > 0 ? nonEmptySeeds : undefined,
          config: {
            ...config,
            ...provider,
          },
        };
      }

      const res = await fetch("/api/evolution/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to start evolution");
        setSubmitting(false);
        return;
      }

      if (data.testCasesPending) {
        toast.success(
          "Evolution started! Test cases are being generated in the background.",
        );
      } else {
        toast.success("Evolution started!");
      }
      router.push(`/run/${data.runId}`);
    } catch {
      toast.error("Network error — failed to start evolution");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Optimize Prompt
        </h1>
        <p className="text-muted-foreground mt-1">
          Evolve your prompt to be as effective as possible
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === "quick" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("quick")}
        >
          <Wand2 className="h-4 w-4 mr-1.5" />
          Quick Mode
        </Button>
        <Button
          variant={mode === "advanced" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("advanced")}
        >
          <Settings2 className="h-4 w-4 mr-1.5" />
          Advanced Mode
        </Button>
        <div className="flex-1" />
        <Badge variant="outline" className="text-xs">
          {mode === "quick"
            ? "Just paste your prompt and go"
            : "Full control over evolution parameters"}
        </Badge>
      </div>

      {/* ═══════ Quick Mode ═══════ */}
      {mode === "quick" && (
        <>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">
                Your Prompt
              </Label>
              <p className="text-sm text-muted-foreground">
                Paste the prompt you want to improve. Use {"{input}"} to mark
                where user input goes (optional).
              </p>
              <Textarea
                value={userPrompt}
                onChange={(e) => {
                  setUserPrompt(e.target.value);
                  setErrors((prev) => ({ ...prev, prompt: "" }));
                }}
                placeholder={`Example: You are a helpful assistant that classifies text sentiment as positive, negative, or neutral.\n\nText: {input}\n\nSentiment:`}
                rows={6}
                className="font-mono text-sm"
              />
              {errors.prompt && (
                <p className="text-xs text-destructive">{errors.prompt}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">
                What should this prompt do?
              </Label>
              <p className="text-sm text-muted-foreground">
                Describe the goal and context. The more specific you are, the
                better the optimization.
              </p>
              <Textarea
                value={context}
                onChange={(e) => {
                  setContext(e.target.value);
                  setErrors((prev) => ({ ...prev, context: "" }));
                }}
                placeholder="Example: This prompt should classify the sentiment of customer reviews as positive, negative, or neutral. It should handle sarcasm, mixed sentiments, and neutral factual statements correctly. Output should be a single word."
                rows={4}
              />
              {errors.context && (
                <p className="text-xs text-destructive">{errors.context}</p>
              )}
            </div>
          </div>

          <Separator />

          <ProviderSelector values={provider} onChange={setProvider} compact />
          {errors.provider && (
            <p className="text-xs text-destructive">{errors.provider}</p>
          )}

          <Separator />

          {/* Quick Mode Settings */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-3">Evolution Settings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Generations</Label>
                    <span className="text-xs text-muted-foreground font-mono">{quickGenerations}</span>
                  </div>
                  <Slider
                    value={[quickGenerations]}
                    onValueChange={(v) => setQuickGenerations(v[0])}
                    min={3}
                    max={20}
                    step={1}
                  />
                  <p className="text-[11px] text-muted-foreground">More generations = better results, longer time</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Population Size</Label>
                    <span className="text-xs text-muted-foreground font-mono">{quickPopulationSize}</span>
                  </div>
                  <Slider
                    value={[quickPopulationSize]}
                    onValueChange={(v) => setQuickPopulationSize(v[0])}
                    min={4}
                    max={16}
                    step={2}
                  />
                  <p className="text-[11px] text-muted-foreground">More prompts per generation = more diversity</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                What happens next?
              </span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
              <li>
                Test cases are auto-generated from your description
              </li>
              <li>
                {quickPopulationSize} prompt variants are created and evolved over {quickGenerations} generations
              </li>
              <li>
                Each variant is scored by an AI judge on the test cases
              </li>
              <li>
                The best prompt is selected through crossover and mutation
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              <p>
                Model: {provider.modelId} | Provider: {provider.provider}
              </p>
              <p className="text-xs">
                Est. API calls: ~{estimateApiCalls(quickPopulationSize, quickGenerations, provider.provider)}
                {provider.provider === "openrouter" && (
                  <span className="text-amber-500 ml-1">(free tier: 50/day)</span>
                )}
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={submitting}
              className="min-w-[200px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Optimize Prompt
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {/* ═══════ Advanced Mode ═══════ */}
      {mode === "advanced" && (
        <>
          <PresetSelector
            presets={presets}
            selectedId={selectedPresetId}
            onSelect={handlePresetSelect}
          />

          <Separator />

          <TaskInput
            value={taskDescription}
            onChange={(v) => {
              setTaskDescription(v);
              setSelectedPresetId(null);
            }}
            error={errors.task}
          />

          <Separator />

          <TestCaseEditor
            testCases={testCases}
            onChange={(v) => {
              setTestCases(v);
              setSelectedPresetId(null);
            }}
            error={errors.testCases}
          />

          <Separator />

          <SeedPrompts
            seeds={seedPrompts}
            onChange={(v) => {
              setSeedPrompts(v);
              setSelectedPresetId(null);
            }}
          />

          <Separator />

          <EvolutionConfig values={config} onChange={setConfig} />

          <Separator />

          <ProviderSelector values={provider} onChange={setProvider} />
          {errors.provider && (
            <p className="text-xs text-destructive">{errors.provider}</p>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              <p>
                Population: {config.populationSize} | Generations:{" "}
                {config.generations} | Provider: {provider.provider}
              </p>
              <p className="text-xs">
                Estimated API calls: ~{estimateApiCalls(config.populationSize, config.generations, provider.provider)}
                {provider.provider === "openrouter" && (
                  <span className="text-amber-500 ml-1">(free tier: 50/day)</span>
                )}
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={submitting}
              className="min-w-[180px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Evolution
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
