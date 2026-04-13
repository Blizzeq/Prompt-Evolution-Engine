"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Wifi,
  Power,
  Download,
  Cpu,
  Zap,
  MonitorCog,
  Search,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { MODEL_PRESETS, type OllamaComputeMode } from "@/lib/engine/types";

type Provider = "ollama" | "google-ai-studio" | "openrouter";

export interface ProviderConfig {
  provider: Provider;
  modelId: string;
  apiKey: string;
  ollamaBaseUrl: string;
  delayBetweenCalls: number;
  ollamaComputeMode: OllamaComputeMode;
  ollamaNumGpuLayers: number;
}

interface ProviderSelectorProps {
  values: ProviderConfig;
  onChange: (values: ProviderConfig) => void;
  compact?: boolean;
}

type HealthStatus = "idle" | "checking" | "ok" | "offline" | "no-model" | "error";

interface ModelOption {
  id: string;
  name: string;
  description?: string;
  free?: boolean;
  installed?: boolean;
}

const DEFAULT_MODELS: Record<Provider, string> = {
  ollama: "gemma4",
  "google-ai-studio": "gemini-2.5-flash",
  openrouter: "google/gemma-4-26b-a4b-it:free",
};

function presetModelsFor(provider: Provider): ModelOption[] {
  return MODEL_PRESETS[provider].map((model) => ({
    id: model.id,
    name: model.label,
    description: model.description,
    free: provider !== "ollama" ? model.label.toLowerCase().includes("free") : undefined,
    installed: provider === "ollama" ? false : undefined,
  }));
}

const API_KEY_STORAGE_PREFIX = "pee_apikey_";

function loadSavedApiKey(provider: Provider): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(`${API_KEY_STORAGE_PREFIX}${provider}`) ?? "";
  } catch {
    return "";
  }
}

function saveApiKey(provider: Provider, key: string) {
  if (typeof window === "undefined") return;
  try {
    if (key.trim()) {
      localStorage.setItem(`${API_KEY_STORAGE_PREFIX}${provider}`, key);
    } else {
      localStorage.removeItem(`${API_KEY_STORAGE_PREFIX}${provider}`);
    }
  } catch { /* quota exceeded or private browsing */ }
}

export function ProviderSelector({ values, onChange, compact }: ProviderSelectorProps) {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("idle");
  const [healthMessage, setHealthMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<"start" | "pull" | null>(null);
  const [pullProgress, setPullProgress] = useState<{ status: string; percent: number } | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const modelRequestRef = useRef<AbortController | null>(null);
  const modelRequestIdRef = useRef(0);
  const initializedRef = useRef(false);

  // Dynamic model list
  const [models, setModels] = useState<ModelOption[]>(() =>
    presetModelsFor(values.provider),
  );
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelFilter, setModelFilter] = useState("");

  const update = (partial: Partial<ProviderConfig>) => {
    if (partial.apiKey !== undefined) {
      saveApiKey(partial.provider ?? values.provider, partial.apiKey);
    }
    onChange({ ...values, ...partial });
  };

  // Load saved API key on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (values.provider !== "ollama" && !values.apiKey) {
      const saved = loadSavedApiKey(values.provider);
      if (saved) {
        onChange({ ...values, apiKey: saved });
      }
    }
  }, []);

  useEffect(() => {
    setModels(presetModelsFor(values.provider));
    setModelFilter("");
    setModelsError(null);
  }, [values.provider]);

  const fetchModels = useCallback(async () => {
    modelRequestRef.current?.abort();
    const requestId = modelRequestIdRef.current + 1;
    modelRequestIdRef.current = requestId;
    const controller = new AbortController();
    modelRequestRef.current = controller;

    setModelsLoading(true);
    setModelsError(null);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: values.provider,
          apiKey: values.apiKey,
          baseUrl: values.ollamaBaseUrl,
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load models");
      }

      if (requestId === modelRequestIdRef.current) {
        setModels(data.models ?? presetModelsFor(values.provider));
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError" && requestId === modelRequestIdRef.current) {
        setModels(presetModelsFor(values.provider));
        setModelsError(
          error instanceof Error ? error.message : "Failed to load models",
        );
      }
    } finally {
      if (requestId === modelRequestIdRef.current) {
        setModelsLoading(false);
      }
      if (modelRequestRef.current === controller) {
        modelRequestRef.current = null;
      }
    }
  }, [values.provider, values.apiKey, values.ollamaBaseUrl]);

  useEffect(() => {
    const shouldAutoFetch = values.provider === "ollama"
      ? true
      : values.apiKey.trim().length >= 10;

    if (!shouldAutoFetch) {
      if (values.provider !== "ollama") {
        setModels(presetModelsFor(values.provider));
      }
      setModelsError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void fetchModels();
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchModels, values.provider, values.apiKey]);

  // Filter models based on search
  const filteredModels = useMemo(() => {
    if (!modelFilter.trim()) return models;
    const q = modelFilter.toLowerCase();
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q),
    );
  }, [models, modelFilter]);

  const checkHealth = async () => {
    setHealthStatus("checking");
    setHealthMessage("");

    try {
      const res = await fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: values.provider,
          apiKey: values.apiKey,
          baseUrl: values.ollamaBaseUrl,
          modelId: values.modelId,
        }),
      });
      const data = await res.json();

      if (data.status === "ready") {
        setHealthStatus("ok");
        setHealthMessage(values.provider === "ollama" ? `Connected — ${values.modelId} available` : "API key valid");
      } else if (data.status === "offline") {
        setHealthStatus("offline");
        setHealthMessage("Ollama is not running");
      } else if (data.status === "no-model") {
        setHealthStatus("no-model");
        setHealthMessage("Ollama running but model not found");
      } else if (data.status === "invalid-key") {
        setHealthStatus("error");
        setHealthMessage("Invalid API key");
      } else if (data.status === "missing-key") {
        setHealthStatus("error");
        setHealthMessage("API key required");
      } else {
        setHealthStatus("error");
        setHealthMessage(data.error ?? "Connection failed");
      }
    } catch {
      setHealthStatus("error");
      setHealthMessage("Failed to reach API");
    }
  };

  const startOllama = async () => {
    setActionLoading("start");
    setHealthMessage("Starting Ollama...");
    try {
      const res = await fetch("/api/ollama/start", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setHealthMessage(data.message);
        await checkHealth();
        await fetchModels();
      } else {
        setHealthStatus("error");
        setHealthMessage(data.error);
      }
    } catch {
      setHealthStatus("error");
      setHealthMessage("Failed to start Ollama");
    } finally {
      setActionLoading(null);
    }
  };

  const pullModel = async () => {
    setActionLoading("pull");
    setPullProgress({ status: "Starting pull...", percent: 0 });
    setHealthMessage("Pulling model...");
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/ollama/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: values.modelId, baseUrl: values.ollamaBaseUrl }),
        signal: abortRef.current.signal,
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.alreadyExists) {
          setPullProgress(null);
          setHealthMessage(data.message);
          await checkHealth();
        } else {
          setHealthStatus("error");
          setHealthMessage(data.error ?? "Pull failed");
          setPullProgress(null);
        }
        setActionLoading(null);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.status === "done") {
              setPullProgress({ status: "Complete!", percent: 100 });
              setTimeout(async () => {
                setPullProgress(null);
                setActionLoading(null);
                await checkHealth();
                await fetchModels();
              }, 1000);
              return;
            }
            if (data.status === "error") {
              setHealthStatus("error");
              setHealthMessage(data.error ?? "Pull failed");
              setPullProgress(null);
              setActionLoading(null);
              return;
            }
            let percent = 0;
            let status = data.status ?? "Pulling...";
            if (data.total > 0) {
              percent = Math.round((data.completed / data.total) * 100);
              const dGB = (data.completed / 1e9).toFixed(1);
              const tGB = (data.total / 1e9).toFixed(1);
              status = `${data.status} (${dGB}/${tGB} GB)`;
            }
            setPullProgress({ status, percent });
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setHealthStatus("error");
        setHealthMessage("Pull stream interrupted");
      }
      setPullProgress(null);
    } finally {
      setActionLoading(null);
      abortRef.current = null;
    }
  };

  const isLoading = healthStatus === "checking" || actionLoading !== null;

  return (
    <div className="space-y-3">
      {!compact && (
        <div>
          <h2 className="text-lg font-semibold">Provider</h2>
          <p className="text-sm text-muted-foreground">
            Choose where the run will execute.
          </p>
        </div>
      )}

      <Tabs
        value={values.provider}
        onValueChange={(v) => {
          if (!v) return;
          const provider = v as Provider;
          const savedKey = provider !== "ollama" ? loadSavedApiKey(provider) : "";
          update({
            provider,
            modelId: DEFAULT_MODELS[provider],
            delayBetweenCalls: provider === "ollama" ? 0 : 4200,
            apiKey: savedKey,
          });
          setHealthStatus("idle");
          setHealthMessage("");
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ollama">Ollama</TabsTrigger>
          <TabsTrigger value="google-ai-studio">Google AI</TabsTrigger>
          <TabsTrigger value="openrouter">OpenRouter</TabsTrigger>
        </TabsList>

        <TabsContent value="ollama" className="space-y-4 mt-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <p className="font-medium">Local runtime</p>
            <p className="text-xs text-muted-foreground">
              No API key required. Requires a local Ollama instance.
            </p>
          </div>
          {!compact && (
            <div className="space-y-2">
              <Label>Ollama Base URL</Label>
              <Input
                value={values.ollamaBaseUrl}
                onChange={(e) => update({ ollamaBaseUrl: e.target.value })}
                placeholder="http://localhost:11434"
              />
            </div>
          )}
          <div className="space-y-3">
            <Label>Compute Backend</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { mode: "auto" as const, icon: MonitorCog, label: "Auto", desc: "Choose automatically" },
                { mode: "gpu" as const, icon: Zap, label: "GPU", desc: "Use available GPU" },
                { mode: "cpu" as const, icon: Cpu, label: "CPU", desc: "Run on CPU only" },
                { mode: "hybrid" as const, icon: Cpu, label: "Hybrid", desc: "Set GPU layers manually" },
              ]).map(({ mode, icon: Icon, label, desc }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => update({ ollamaComputeMode: mode })}
                  className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                    values.ollamaComputeMode === mode
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${values.ollamaComputeMode === mode ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
            {values.ollamaComputeMode === "hybrid" && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <Label>GPU Layers: {values.ollamaNumGpuLayers}</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={values.ollamaNumGpuLayers}
                  onChange={(e) => update({ ollamaNumGpuLayers: parseInt(e.target.value) || 1 })}
                  className="w-28"
                />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="google-ai-studio" className="space-y-4 mt-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <p className="font-medium">Google AI Studio</p>
            <p className="text-xs text-muted-foreground">
              Cloud API. Free tier limits apply.
            </p>
          </div>
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              value={values.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder="AIza..."
            />
          </div>
        </TabsContent>

        <TabsContent value="openrouter" className="space-y-4 mt-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <p className="font-medium">OpenRouter</p>
            <p className="text-xs text-muted-foreground">
              Cloud API with a broad model catalog.
            </p>
          </div>
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              value={values.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder="sk-or-..."
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Model Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Model</Label>
          <div className="flex items-center gap-2">
            {modelsLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchModels}
              disabled={modelsLoading}
            >
              {values.provider === "ollama" ? "Refresh" : "Load"}
            </Button>
          </div>
        </div>

        {/* Search for OpenRouter (many models) */}
        {values.provider === "openrouter" && models.length > 10 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              placeholder="Search models..."
              className="pl-8 h-9"
            />
          </div>
        )}

        <Select
          value={values.modelId}
          onValueChange={(v) => { if (v) update({ modelId: v }); }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select model..." />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {filteredModels.length === 0 && !modelsLoading ? (
              <SelectItem value={values.modelId} disabled>
                No models found
              </SelectItem>
            ) : (
              filteredModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-2">
                    <span>{model.name}</span>
                    {model.free && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 shrink-0">
                        free
                      </span>
                    )}
                    {model.installed === false && values.provider === "ollama" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 shrink-0">
                        not installed
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {values.provider !== "ollama" && !values.apiKey.trim() && (
          <p className="text-xs text-muted-foreground">
            Enter an API key to load the live model catalog.
          </p>
        )}

        {modelsError && (
          <p className="text-xs text-destructive">{modelsError}</p>
        )}
      </div>

      {/* Health Check */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={checkHealth}
          disabled={isLoading}
        >
          {healthStatus === "checking" ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Wifi className="h-3.5 w-3.5 mr-1.5" />
          )}
          Test Connection
        </Button>

        {healthStatus !== "idle" && (
          <>
            {healthStatus === "ok" ? (
              <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {healthMessage}
              </Badge>
            ) : healthStatus === "checking" ? (
              <Badge variant="secondary">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Checking...
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                <XCircle className="h-3 w-3 mr-1" />
                {healthMessage}
              </Badge>
            )}
          </>
        )}
      </div>

      {/* Ollama action buttons */}
      {values.provider === "ollama" && healthStatus === "offline" && (
        <div className="flex items-center gap-2 rounded-lg border p-3">
          <div className="flex-1">
            <p className="text-sm font-medium">Ollama is not running</p>
            <p className="text-xs text-muted-foreground">Start Ollama to use the local runtime.</p>
          </div>
          <Button size="sm" onClick={startOllama} disabled={isLoading}>
            {actionLoading === "start" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Power className="h-3.5 w-3.5 mr-1.5" />}
            Start Ollama
          </Button>
        </div>
      )}

      {values.provider === "ollama" && healthStatus === "no-model" && (
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium">Model not found</p>
              <p className="text-xs text-muted-foreground">Pull {values.modelId} from the Ollama registry.</p>
            </div>
            <Button size="sm" onClick={pullModel} disabled={isLoading}>
              {actionLoading === "pull" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
              {actionLoading === "pull" ? "Pulling..." : "Pull Model"}
            </Button>
          </div>
          {pullProgress && (
            <div className="space-y-1.5">
              <Progress value={pullProgress.percent} className="h-2" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{pullProgress.status}</span>
                <span>{pullProgress.percent}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delay */}
      {!compact && (
        <div className="space-y-2">
          <Label>Call Delay: {values.delayBetweenCalls}ms</Label>
          <Input
            type="number"
            min={0}
            max={30000}
            step={100}
            value={values.delayBetweenCalls}
            onChange={(e) => update({ delayBetweenCalls: parseInt(e.target.value) || 0 })}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">
            {values.provider === "ollama" ? "No delay is usually needed locally." : "Use a delay if the provider has free-tier rate limits."}
          </p>
        </div>
      )}
    </div>
  );
}
