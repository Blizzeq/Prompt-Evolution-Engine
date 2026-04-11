"use client";

import { useState, useRef } from "react";
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
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { GemmaModelId, OllamaComputeMode } from "@/lib/engine/types";

type Provider = "ollama" | "google-ai-studio" | "openrouter";

export interface ProviderConfig {
  provider: Provider;
  modelId: GemmaModelId;
  apiKey: string;
  ollamaBaseUrl: string;
  delayBetweenCalls: number;
  ollamaComputeMode: OllamaComputeMode;
  ollamaNumGpuLayers: number;
}

interface ProviderSelectorProps {
  values: ProviderConfig;
  onChange: (values: ProviderConfig) => void;
}

type HealthStatus = "idle" | "checking" | "ok" | "offline" | "no-model" | "error";

export function ProviderSelector({ values, onChange }: ProviderSelectorProps) {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("idle");
  const [healthMessage, setHealthMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<"start" | "pull" | null>(
    null,
  );
  const [pullProgress, setPullProgress] = useState<{
    status: string;
    percent: number;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const update = (partial: Partial<ProviderConfig>) =>
    onChange({ ...values, ...partial });

  const checkHealth = async () => {
    setHealthStatus("checking");
    setHealthMessage("");

    try {
      const params = new URLSearchParams({ provider: values.provider });
      if (values.provider === "ollama") {
        params.set("baseUrl", values.ollamaBaseUrl);
        params.set("modelId", values.modelId);
      } else {
        params.set("apiKey", values.apiKey);
      }

      const res = await fetch(`/api/health?${params}`);
      const data = await res.json();

      if (data.status === "ready") {
        setHealthStatus("ok");
        if (values.provider === "ollama") {
          setHealthMessage(`Connected — ${values.modelId} available`);
        } else {
          setHealthMessage("API key valid");
        }
      } else if (data.status === "offline") {
        setHealthStatus("offline");
        setHealthMessage("Ollama is not running");
      } else if (data.status === "no-model") {
        setHealthStatus("no-model");
        setHealthMessage("Ollama running but no Gemma model found");
      } else if (data.status === "invalid-key") {
        setHealthStatus("error");
        setHealthMessage("Invalid API key");
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
        // Re-check health after start
        await checkHealth();
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
        body: JSON.stringify({
          model: values.modelId,
          baseUrl: values.ollamaBaseUrl,
        }),
        signal: abortRef.current.signal,
      });

      // If JSON response (already exists or error)
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

      // SSE stream
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
              }, 1000);
              return;
            }

            if (data.status === "error") {
              if (data.error === "update-required") {
                setHealthStatus("error");
                setHealthMessage("This model requires a newer version of Ollama");
              } else {
                setHealthStatus("error");
                setHealthMessage(data.error ?? "Pull failed");
              }
              setPullProgress(null);
              setActionLoading(null);
              return;
            }

            // Calculate progress
            let percent = 0;
            let status = data.status ?? "Pulling...";
            if (data.total > 0) {
              percent = Math.round((data.completed / data.total) * 100);
              const downloadedGB = (data.completed / 1e9).toFixed(1);
              const totalGB = (data.total / 1e9).toFixed(1);
              status = `${data.status} (${downloadedGB}/${totalGB} GB)`;
            }

            setPullProgress({ status, percent });
          } catch {
            // Skip malformed
          }
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
      <div>
        <h2 className="text-lg font-semibold">AI Provider</h2>
        <p className="text-sm text-muted-foreground">
          Choose how to run the LLM for evolution
        </p>
      </div>

      <Tabs
        value={values.provider}
        onValueChange={(v) => {
          const provider = v as Provider;
          update({
            provider,
            delayBetweenCalls: provider === "ollama" ? 0 : 4200,
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
            <p className="font-medium">Local GPU inference</p>
            <p className="text-xs text-muted-foreground">
              No API key needed. No rate limits. Requires Ollama running locally
              with Gemma 4 pulled.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Ollama Base URL</Label>
            <Input
              value={values.ollamaBaseUrl}
              onChange={(e) => update({ ollamaBaseUrl: e.target.value })}
              placeholder="http://localhost:11434"
            />
          </div>

          {/* Compute Backend */}
          <div className="space-y-3">
            <Label>Compute Backend</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    mode: "auto" as const,
                    icon: MonitorCog,
                    label: "Auto",
                    desc: "Ollama decides (GPU if available)",
                  },
                  {
                    mode: "gpu" as const,
                    icon: Zap,
                    label: "GPU Only",
                    desc: "All layers on GPU — fastest",
                  },
                  {
                    mode: "cpu" as const,
                    icon: Cpu,
                    label: "CPU Only",
                    desc: "No GPU — works on any machine",
                  },
                  {
                    mode: "hybrid" as const,
                    icon: Cpu,
                    label: "Hybrid",
                    desc: "Custom GPU/CPU layer split",
                  },
                ] as const
              ).map(({ mode, icon: Icon, label, desc }) => (
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
                  <Icon
                    className={`h-4 w-4 mt-0.5 shrink-0 ${
                      values.ollamaComputeMode === mode
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      {desc}
                    </p>
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
                  onChange={(e) =>
                    update({
                      ollamaNumGpuLayers: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-28"
                />
                <p className="text-[11px] text-muted-foreground">
                  Number of model layers offloaded to GPU. Rest runs on CPU.
                  Higher = more GPU usage. Typical range: 10–60 depending on
                  VRAM.
                </p>
              </div>
            )}

            {values.ollamaComputeMode === "cpu" && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                CPU inference is significantly slower. Use if you have no GPU or
                limited VRAM.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="google-ai-studio" className="space-y-4 mt-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <p className="font-medium">Google AI Studio (free tier)</p>
            <p className="text-xs text-muted-foreground">
              Free API with 15 RPM rate limit. Get a key at ai.google.dev.
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
            <p className="font-medium">OpenRouter (free models)</p>
            <p className="text-xs text-muted-foreground">
              Access free Gemma models via OpenRouter API. Get a key at
              openrouter.ai.
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

      {/* Model Selection + Health Check */}
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-2">
          <Label>Model</Label>
          <Select
            value={values.modelId}
            onValueChange={(v) => update({ modelId: v as GemmaModelId })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemma4">
                Gemma 4 (recommended)
              </SelectItem>
              <SelectItem value="gemma4:27b">
                Gemma 4 27B (larger)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={checkHealth}
          disabled={isLoading}
        >
          {healthStatus === "checking" ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Wifi className="h-4 w-4 mr-1.5" />
          )}
          Test Connection
        </Button>
      </div>

      {/* Status + Action Buttons */}
      {healthStatus !== "idle" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {healthStatus === "ok" ? (
              <Badge
                variant="secondary"
                className="bg-green-500/10 text-green-600"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {healthMessage}
              </Badge>
            ) : healthStatus === "checking" ? (
              <Badge variant="secondary">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Checking...
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-destructive/10 text-destructive"
              >
                <XCircle className="h-3 w-3 mr-1" />
                {healthMessage}
              </Badge>
            )}
          </div>

          {/* Ollama action buttons based on status */}
          {values.provider === "ollama" && healthStatus === "offline" && (
            <div className="flex items-center gap-2 rounded-lg border p-3">
              <div className="flex-1">
                <p className="text-sm font-medium">Ollama is not running</p>
                <p className="text-xs text-muted-foreground">
                  Start Ollama to use local GPU inference
                </p>
              </div>
              <Button
                size="sm"
                onClick={startOllama}
                disabled={isLoading}
              >
                {actionLoading === "start" ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Power className="h-3.5 w-3.5 mr-1.5" />
                )}
                Start Ollama
              </Button>
            </div>
          )}

          {values.provider === "ollama" && healthStatus === "no-model" && (
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium">Model not found</p>
                  <p className="text-xs text-muted-foreground">
                    Pull {values.modelId} from Ollama registry
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={pullModel}
                  disabled={isLoading}
                >
                  {actionLoading === "pull" ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                  )}
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

          {/* Update Ollama prompt */}
          {values.provider === "ollama" &&
            healthStatus === "error" &&
            healthMessage.includes("newer version") && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">Ollama update required</p>
                  <p className="text-xs text-muted-foreground">
                    {values.modelId} needs a newer Ollama version. Update or
                    select a different model.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    window.open("https://ollama.com/download", "_blank")
                  }
                >
                  Update Ollama
                </Button>
              </div>
            )}
        </div>
      )}

      {/* Delay */}
      <div className="space-y-2">
        <Label>Delay Between Calls: {values.delayBetweenCalls}ms</Label>
        <Input
          type="number"
          min={0}
          max={30000}
          step={100}
          value={values.delayBetweenCalls}
          onChange={(e) =>
            update({ delayBetweenCalls: parseInt(e.target.value) || 0 })
          }
          className="w-32"
        />
        <p className="text-xs text-muted-foreground">
          {values.provider === "ollama"
            ? "No delay needed for local inference"
            : "Recommended: 4200ms for free tier rate limits"}
        </p>
      </div>
    </div>
  );
}
