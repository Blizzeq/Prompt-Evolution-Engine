"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import { Loader2, Play } from "lucide-react";
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
  populationSize: 8,
  generations: 10,
  mutationRate: 0.3,
  eliteCount: 2,
  eaVariant: "ga",
  evalMethod: "llm-judge",
  crossoverStrategy: "simple",
  mutationStrategies: [...ALL_MUTATION_STRATEGIES],
  fitnessThreshold: 0.1,
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

export default function NewRunPage() {
  const router = useRouter();
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

  const validate = (): boolean => {
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
    if (!validate()) {
      toast.error("Please fix validation errors before starting");
      return;
    }

    setSubmitting(true);

    try {
      const validTestCases = testCases.filter(
        (tc) => tc.input.trim() && tc.expectedOutput.trim(),
      );
      const nonEmptySeeds = seedPrompts.filter((s) => s.trim());

      const body = {
        taskDescription,
        testCases: validTestCases,
        seedPrompts: nonEmptySeeds.length > 0 ? nonEmptySeeds : undefined,
        config: {
          ...config,
          ...provider,
        },
      };

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

      toast.success("Evolution started!");
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
          New Evolution Run
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure and start a new prompt evolution experiment
        </p>
      </div>

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
            Estimated API calls: ~
            {config.populationSize * config.generations * 3}
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
    </div>
  );
}
