"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
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
import {
  Activity,
  BrainCircuit,
  ChevronRight,
  Loader2,
  Play,
  Sparkles,
  Settings2,
  Wand2,
  Info,
  Zap,
} from "lucide-react";
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

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
};

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35 },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2 },
  },
};

const MODE_COPY = {
  quick: {
    title: "Quick setup",
    description: "Prompt, context, provider, and two tuning controls.",
  },
  advanced: {
    title: "Advanced setup",
    description: "Presets, test cases, seed prompts, and full search settings.",
  },
};

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

  const validateQuick = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (userPrompt.length < 5)
      newErrors.prompt = "Enter a prompt to optimize (at least 5 characters)";
    if (context.length < 10)
      newErrors.context =
        "Describe what the prompt should do (at least 10 characters)";
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
      newErrors.testCases =
        "At least 3 complete test cases required (input + expected output)";
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
      toast.error("Fix the highlighted fields before starting the run");
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
        toast.success("Run started. Test cases are being generated in the background.");
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

  const modeCopy = MODE_COPY[mode];

  return (
    <motion.div
      className="space-y-6 pb-20 lg:space-y-8"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_24rem]">
        <div className="panel-strong hero-gradient relative overflow-hidden rounded-[2rem] px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-11">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_65%)] lg:block" />
          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                <Sparkles className="h-3 w-3" />
                Run setup
              </Badge>
              <Badge variant="secondary">{modeCopy.title}</Badge>
            </div>

            <div className="space-y-4">
              <h1 className="text-[2.2rem] font-semibold leading-[0.98] tracking-[-0.08em] text-foreground sm:text-[3rem] lg:text-[4rem]">
                Configure a run and start the search.
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {modeCopy.description}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="panel-soft rounded-[1.35rem] p-4">
                <p className="section-kicker">Strategies</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                  {ALL_MUTATION_STRATEGIES.length}
                </p>
              </div>
              <div className="panel-soft rounded-[1.35rem] p-4">
                <p className="section-kicker">Presets</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                  {presets.length}
                </p>
              </div>
              <div className="panel-soft rounded-[1.35rem] p-4">
                <p className="section-kicker">Est. calls</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                  ~{estCalls}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="panel rounded-[1.75rem] p-5 sm:p-6">
          <p className="section-kicker">Setup mode</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
            Choose your level of control
          </h2>

          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={() => setMode("quick")}
              className={`rounded-[1.35rem] border px-4 py-4 text-left transition-all ${
                mode === "quick"
                  ? "border-primary/25 bg-primary/10 shadow-glow"
                  : "border-white/10 bg-white/[0.04] hover:border-primary/15 dark:border-white/6 dark:bg-white/[0.03]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Wand2 className="h-4 w-4 text-primary" />
                    Quick setup
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Prompt, context, provider, and two core tuning controls.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("advanced")}
              className={`rounded-[1.35rem] border px-4 py-4 text-left transition-all ${
                mode === "advanced"
                  ? "border-primary/25 bg-primary/10 shadow-glow"
                  : "border-white/10 bg-white/[0.04] hover:border-primary/15 dark:border-white/6 dark:bg-white/[0.03]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Settings2 className="h-4 w-4 text-primary" />
                    Advanced setup
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Presets, full test editing, seed prompts, and search configuration.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <AnimatePresence mode="wait">
          {mode === "quick" && (
            <motion.div
              key="quick"
              className="space-y-4"
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="panel rounded-[1.75rem] p-5 sm:p-6">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Prompt
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Paste the prompt you want to optimize.
                </p>

                <div className="mt-5 space-y-2">
                  <Textarea
                    value={userPrompt}
                    onChange={(e) => {
                      setUserPrompt(e.target.value);
                      setErrors((prev) => ({ ...prev, prompt: "" }));
                    }}
                    placeholder={`Enter the prompt you want to optimize...\n\nExample: You are a helpful assistant that classifies text sentiment.\n\nText: {input}\nSentiment:`}
                    rows={6}
                    className="font-mono text-sm resize-none"
                  />
                  {errors.prompt ? (
                    <p className="text-xs text-destructive">{errors.prompt}</p>
                  ) : null}
                </div>
              </div>

              <div className="panel rounded-[1.75rem] p-5 sm:p-6">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Info className="h-4 w-4 text-primary" />
                  Context
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add goals, constraints, audience, or output rules.
                </p>

                <div className="mt-5 space-y-2">
                  <Textarea
                    value={context}
                    onChange={(e) => {
                      setContext(e.target.value);
                      setErrors((prev) => ({ ...prev, context: "" }));
                    }}
                    placeholder="Describe what the prompt should do, its goals, and any constraints..."
                    rows={4}
                    className="resize-none"
                  />
                  {errors.context ? (
                    <p className="text-xs text-destructive">{errors.context}</p>
                  ) : null}
                </div>
              </div>

              <div className="panel-grid panel rounded-[1.75rem] p-5 sm:p-6">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <BrainCircuit className="h-4 w-4 text-primary" />
                  Tuning
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Set search depth and run size.
                </p>

                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Generations</Label>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
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
                    <p className="text-[11px] text-muted-foreground">
                      More generations usually improve results, but increase run time.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Population size</Label>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
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
                    <p className="text-[11px] text-muted-foreground">
                      Larger populations explore more variants per generation.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {mode === "advanced" && (
            <motion.div
              key="advanced"
              className="space-y-4"
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="panel rounded-[1.75rem] p-5 sm:p-6">
                <PresetSelector
                  presets={presets}
                  selectedId={selectedPresetId}
                  onSelect={handlePresetSelect}
                />
              </div>

              <TaskInput
                value={taskDescription}
                onChange={(value) => {
                  setTaskDescription(value);
                  setSelectedPresetId(null);
                }}
                error={errors.task}
              />

              <TestCaseEditor
                testCases={testCases}
                onChange={(value) => {
                  setTestCases(value);
                  setSelectedPresetId(null);
                }}
                error={errors.testCases}
              />

              <div className="space-y-2">
                <SeedPrompts
                  seeds={seedPrompts}
                  onChange={(value) => {
                    setSeedPrompts(value);
                    setSelectedPresetId(null);
                  }}
                />
                {errors.seeds ? (
                  <p className="px-1 text-xs text-destructive">{errors.seeds}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <EvolutionConfig values={config} onChange={setConfig} />
                {errors.config ? (
                  <p className="px-1 text-xs text-destructive">{errors.config}</p>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.aside
          className="space-y-4 xl:sticky xl:top-24"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
        >
          <div className="panel rounded-[1.75rem] p-5 sm:p-6">
            <p className="section-kicker">Execution</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
              Provider and model
            </h2>
            <div className="mt-5">
              <ProviderSelector
                values={provider}
                onChange={setProvider}
                compact={mode === "quick"}
              />
            </div>
            {errors.provider ? (
              <p className="mt-3 text-xs text-destructive">{errors.provider}</p>
            ) : null}
          </div>

          <div className="panel-grid panel rounded-[1.75rem] p-5 sm:p-6">
            <p className="section-kicker">Run summary</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
              Start run
            </h2>

            <div className="mt-5 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Mode
                </span>
                <span className="font-medium text-foreground">{modeCopy.title}</span>
              </div>
              <div className="flex items-center justify-between rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Runtime
                </span>
                <span className="font-medium text-foreground">
                  {provider.provider} / {provider.modelId}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 dark:border-white/6 dark:bg-white/[0.03]">
                <span>Estimated API calls</span>
                <span className="font-mono text-foreground">~{estCalls}</span>
              </div>
            </div>

            <div className="mt-5 rounded-[1.25rem] border border-primary/10 bg-primary/[0.06] p-4 text-sm leading-relaxed text-muted-foreground">
              {mode === "quick"
                ? `About ${quickPopulationSize} candidates across ${quickGenerations} generations.`
                : "Uses explicit tests and seed prompts for more controlled comparisons."}
            </div>

            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-5 w-full gap-2"
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

            {provider.provider === "openrouter" ? (
              <p className="mt-3 text-[11px] text-warning">
                OpenRouter free models may be rate-limited. Keep an eye on the estimated request volume.
              </p>
            ) : null}
          </div>
        </motion.aside>
      </section>
    </motion.div>
  );
}
