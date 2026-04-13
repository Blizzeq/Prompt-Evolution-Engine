"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  Play,
  Settings2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import type { TaskPreset, MutationType } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

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

// ─── Prompt builder fields ───

interface PromptFields {
  persona: string;
  task: string;
  steps: string;
  context: string;
  goal: string;
  format: string;
}

const EMPTY_FIELDS: PromptFields = {
  persona: "",
  task: "",
  steps: "",
  context: "",
  goal: "",
  format: "",
};

const FIELD_META: {
  key: keyof PromptFields;
  label: string;
  hint: string;
  placeholder: string;
  rows: number;
  required: boolean;
}[] = [
  {
    key: "persona",
    label: "Persona",
    hint: "Who should the AI act as? The more specific the role, the better the output quality.",
    placeholder: "e.g. You are an experienced nutritionist specializing in meal planning for athletes.",
    rows: 2,
    required: true,
  },
  {
    key: "task",
    label: "Task",
    hint: "What is the core task? State clearly what the AI needs to produce.",
    placeholder: "e.g. Create a weekly meal plan optimized for muscle recovery after training.",
    rows: 2,
    required: true,
  },
  {
    key: "steps",
    label: "Steps",
    hint: "Break down how to complete the task. Number your steps to enforce a logical order.",
    placeholder: "e.g.\n1. Assess caloric needs based on training intensity\n2. Distribute macros across 5 meals\n3. Include pre- and post-workout nutrition timing",
    rows: 4,
    required: false,
  },
  {
    key: "context",
    label: "Context & constraints",
    hint: "Background info, rules, or limitations the AI must follow. Include user details if relevant.",
    placeholder: "e.g. The user will provide their weight, training schedule, and dietary restrictions. Prioritize whole foods over supplements. Budget-friendly options preferred. No more than 30 min prep per meal.",
    rows: 3,
    required: true,
  },
  {
    key: "goal",
    label: "Goal",
    hint: "What is the desired outcome? What should the user walk away with?",
    placeholder: "e.g. The user gets a complete shopping list and day-by-day meal schedule they can follow immediately.",
    rows: 2,
    required: false,
  },
  {
    key: "format",
    label: "Output format",
    hint: "How should the response be structured? Tables, bullet points, sections, length?",
    placeholder: "e.g. Table with columns: Meal, Ingredients, Calories, Protein (g), Prep Time. One table per day. Include a summary row with daily totals.",
    rows: 2,
    required: false,
  },
];

/** Build a combined prompt from the 6 structured fields. */
function buildPromptFromFields(fields: PromptFields): string {
  const parts: string[] = [];

  if (fields.persona.trim()) {
    parts.push(fields.persona.trim());
  }

  if (fields.task.trim()) {
    parts.push(fields.task.trim());
  }

  if (fields.steps.trim()) {
    parts.push(fields.steps.trim());
  }

  if (fields.context.trim()) {
    parts.push(fields.context.trim());
  }

  if (fields.goal.trim()) {
    parts.push(fields.goal.trim());
  }

  if (fields.format.trim()) {
    parts.push(fields.format.trim());
  }

  parts.push("{input}");

  return parts.join("\n\n");
}

/** Build the task description from fields for evaluation context. */
function buildTaskDescription(fields: PromptFields): string {
  const parts: string[] = [];

  if (fields.task.trim()) {
    parts.push(fields.task.trim());
  }
  if (fields.context.trim()) {
    parts.push(fields.context.trim());
  }
  if (fields.goal.trim()) {
    parts.push(fields.goal.trim());
  }

  return parts.join(". ");
}

function estimateApiCalls(
  popSize: number,
  generations: number,
  providerType: string
): number {
  const isCloud = providerType !== "ollama";
  const eliteCount = 2;
  const testCaseCount = 5;
  let calls = 2;
  const evalCallsPerPrompt = isCloud ? 1 : testCaseCount + 1;
  calls += popSize * evalCallsPerPrompt;
  const offspringPerGen = popSize - eliteCount;
  for (let g = 1; g < generations; g++) {
    calls += offspringPerGen;
    calls += offspringPerGen * evalCallsPerPrompt;
  }
  return calls;
}

type Mode = "quick" | "advanced";

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

export default function NewRunPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("quick");

  // Quick mode — structured fields
  const [fields, setFields] = useState<PromptFields>(EMPTY_FIELDS);
  const [showPreview, setShowPreview] = useState(false);
  const [quickGenerations, setQuickGenerations] = useState(5);
  const [quickPopulationSize, setQuickPopulationSize] = useState(6);

  // Advanced mode
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
      .catch(() => toast.error("Could not load presets"));
  }, []);

  const handlePresetSelect = (preset: TaskPreset) => {
    setSelectedPresetId(preset.id);
    setTaskDescription(preset.taskDescription);
    setTestCases(
      preset.testCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        weight: tc.weight,
      }))
    );
    setSeedPrompts(preset.seedPrompts ?? []);
    if (preset.suggestedConfig) {
      setConfig((prev) => ({ ...prev, ...preset.suggestedConfig }));
    }
    setErrors({});
  };

  const updateField = (key: keyof PromptFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validateQuick = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (fields.persona.trim().length < 5)
      newErrors.persona = "Describe who the AI should act as (at least 5 characters)";
    if (fields.task.trim().length < 5)
      newErrors.task = "Describe the core task (at least 5 characters)";
    if (fields.context.trim().length < 5)
      newErrors.context = "Add context or constraints (at least 5 characters)";
    if (provider.provider !== "ollama" && !provider.apiKey.trim())
      newErrors.provider = "API key is required for cloud providers";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateAdvanced = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (taskDescription.length < 10)
      newErrors.task = "Task description must be at least 10 characters";
    if (taskDescription.length > 2000)
      newErrors.task = "Task description must be at most 2000 characters";
    const validTestCases = testCases.filter(
      (tc) => tc.input.trim() && tc.expectedOutput.trim()
    );
    if (validTestCases.length < 3)
      newErrors.testCases = "At least 3 complete test cases required (input + expected output)";
    const nonEmptySeeds = seedPrompts.filter((s) => s.trim());
    for (const seed of nonEmptySeeds) {
      if (!seed.includes("{input}")) {
        newErrors.seeds = "All seed prompts must contain {input} placeholder";
        break;
      }
    }
    if (provider.provider !== "ollama" && !provider.apiKey.trim())
      newErrors.provider = "API key is required for cloud providers";
    if (config.eliteCount >= config.populationSize)
      newErrors.config = "Elite count must be less than population size";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (mode === "quick" && !validateQuick()) {
      toast.error("Fill in the required fields before starting");
      return;
    }
    if (mode === "advanced" && !validateAdvanced()) {
      toast.error("Fix the highlighted fields before starting the run");
      return;
    }
    setSubmitting(true);
    try {
      let body: Record<string, unknown>;
      if (mode === "quick") {
        const userPrompt = buildPromptFromFields(fields);
        const context = buildTaskDescription(fields);
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
          (tc) => tc.input.trim() && tc.expectedOutput.trim()
        );
        const nonEmptySeeds = seedPrompts.filter((s) => s.trim());
        body = {
          mode: "advanced",
          taskDescription,
          testCases: validTestCases,
          seedPrompts: nonEmptySeeds.length > 0 ? nonEmptySeeds : undefined,
          config: { ...config, ...provider },
        };
      }
      const res = await fetch("/api/evolution/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not start the run");
        setSubmitting(false);
        return;
      }
      if (data.testCasesPending) {
        toast.success("Run started. Test cases are being generated.");
      } else {
        toast.success("Run started.");
      }
      router.push(`/run/${data.runId}`);
    } catch {
      toast.error("Network error. Could not start the run.");
      setSubmitting(false);
    }
  };

  const estCalls =
    mode === "quick"
      ? estimateApiCalls(quickPopulationSize, quickGenerations, provider.provider)
      : estimateApiCalls(config.populationSize, config.generations, provider.provider);

  const builtPrompt = buildPromptFromFields(fields);
  const filledCount = FIELD_META.filter(
    (f) => fields[f.key].trim().length > 0
  ).length;

  return (
    <motion.div
      className="mx-auto max-w-4xl space-y-6 pb-12"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg border border-border/40 bg-card/80 p-1">
        {([
          { id: "quick" as const, label: "Quick setup", icon: Wand2 },
          { id: "advanced" as const, label: "Advanced setup", icon: Settings2 },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              mode === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Form content */}
      <AnimatePresence mode="wait">
        {mode === "quick" ? (
          <motion.div
            key="quick"
            className="space-y-4"
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Structured prompt fields */}
            <div className="space-y-3">
              {FIELD_META.map((meta, i) => (
                <motion.div
                  key={meta.key}
                  className="rounded-xl border border-border/40 bg-card/80 p-5"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Label className="text-sm font-medium">
                        <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                          {i + 1}
                        </span>
                        {meta.label}
                        {meta.required && (
                          <span className="ml-1 text-destructive">*</span>
                        )}
                      </Label>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {meta.hint}
                      </p>
                    </div>
                    {fields[meta.key].trim() && (
                      <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                        Done
                      </span>
                    )}
                  </div>
                  <Textarea
                    value={fields[meta.key]}
                    onChange={(e) => updateField(meta.key, e.target.value)}
                    placeholder={meta.placeholder}
                    rows={meta.rows}
                    className="mt-3 resize-none text-sm"
                  />
                  {errors[meta.key] && (
                    <p className="mt-2 text-xs text-destructive">
                      {errors[meta.key]}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Prompt preview */}
            <div className="rounded-xl border border-border/40 bg-card/80">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left"
              >
                <div className="flex items-center gap-2">
                  {showPreview ? (
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">
                    Preview built prompt
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {filledCount}/6 sections
                  </span>
                </div>
                {showPreview ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <AnimatePresence>
                {showPreview && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border/30 px-5 py-4">
                      <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
                        {builtPrompt || "Fill in the fields above to see the combined prompt..."}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tuning */}
            <div className="rounded-xl border border-border/40 bg-card/80 p-5">
              <Label className="text-sm font-medium">Tuning</Label>
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Generations</span>
                    <span className="font-mono text-xs tabular-nums text-foreground">
                      {quickGenerations}
                    </span>
                  </div>
                  <Slider
                    value={[quickGenerations]}
                    onValueChange={(value) => setQuickGenerations(value[0])}
                    min={3}
                    max={20}
                    step={1}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Population size</span>
                    <span className="font-mono text-xs tabular-nums text-foreground">
                      {quickPopulationSize}
                    </span>
                  </div>
                  <Slider
                    value={[quickPopulationSize]}
                    onValueChange={(value) => setQuickPopulationSize(value[0])}
                    min={4}
                    max={16}
                    step={2}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="advanced"
            className="space-y-4"
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="rounded-xl border border-border/40 bg-card/80 p-5">
              <PresetSelector
                presets={presets}
                selectedId={selectedPresetId}
                onSelect={handlePresetSelect}
              />
            </div>

            <div className="rounded-xl border border-border/40 bg-card/80 p-5">
              <TaskInput
                value={taskDescription}
                onChange={(value) => {
                  setTaskDescription(value);
                  setSelectedPresetId(null);
                }}
                error={errors.task}
              />
            </div>

            <div className="rounded-xl border border-border/40 bg-card/80 p-5">
              <TestCaseEditor
                testCases={testCases}
                onChange={(value) => {
                  setTestCases(value);
                  setSelectedPresetId(null);
                }}
                error={errors.testCases}
              />
            </div>

            <div className="rounded-xl border border-border/40 bg-card/80 p-5 space-y-2">
              <SeedPrompts
                seeds={seedPrompts}
                onChange={(value) => {
                  setSeedPrompts(value);
                  setSelectedPresetId(null);
                }}
              />
              {errors.seeds && (
                <p className="px-1 text-xs text-destructive">{errors.seeds}</p>
              )}
            </div>

            <div className="rounded-xl border border-border/40 bg-card/80 p-5 space-y-2">
              <EvolutionConfig values={config} onChange={setConfig} />
              {errors.config && (
                <p className="px-1 text-xs text-destructive">{errors.config}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Provider */}
      <div className="rounded-xl border border-border/40 bg-card/80 p-5">
        <Label className="text-sm font-medium">Provider and model</Label>
        <div className="mt-3">
          <ProviderSelector
            values={provider}
            onChange={setProvider}
            compact={mode === "quick"}
          />
        </div>
        {errors.provider && (
          <p className="mt-2 text-xs text-destructive">{errors.provider}</p>
        )}
      </div>

      {/* Start */}
      <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card/80 p-5">
        <div className="text-sm text-muted-foreground">
          ~{estCalls} API calls &middot; {mode === "quick" ? quickPopulationSize : config.populationSize} candidates &middot; {mode === "quick" ? quickGenerations : config.generations} generations
        </div>
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={submitting}
          className="gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Start run
            </>
          )}
        </Button>
      </div>

      {provider.provider === "openrouter" && (
        <p className="text-xs text-warning">
          OpenRouter free models may be rate-limited.
        </p>
      )}
    </motion.div>
  );
}
