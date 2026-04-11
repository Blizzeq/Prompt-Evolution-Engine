"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Square, Loader2, CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import type { RunStatus, StopReason } from "@/lib/engine/types";

interface RunControlsProps {
  runId: string;
  status: RunStatus;
  stopReason: StopReason | null;
  errorMessage: string | null;
}

const statusConfig: Record<
  RunStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  pending: { label: "Pending", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  initializing: { label: "Initializing", variant: "secondary", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  running: { label: "Running", variant: "default", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  completed: { label: "Completed", variant: "outline", icon: <CheckCircle2 className="h-3 w-3" /> },
  stopped: { label: "Stopped", variant: "secondary", icon: <Square className="h-3 w-3" /> },
  failed: { label: "Failed", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
};

const stopReasonLabels: Record<StopReason, string> = {
  "user-stopped": "Stopped by user",
  "early-convergence": "Early convergence",
  "fitness-reached": "Fitness threshold reached",
  "api-error": "API error",
};

export function RunControls({ runId, status, stopReason, errorMessage }: RunControlsProps) {
  const [stopping, setStopping] = useState(false);
  const { label, variant, icon } = statusConfig[status];

  const isActive = status === "running" || status === "initializing";

  const handleStop = async () => {
    setStopping(true);
    try {
      const res = await fetch(`/api/evolution/${runId}/stop`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to stop");
      } else {
        toast.success("Stopping evolution...");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Badge variant={variant} className="gap-1.5 px-2.5 py-1">
        {icon}
        {label}
      </Badge>

      {stopReason && (
        <span className="text-xs text-muted-foreground">
          {stopReasonLabels[stopReason]}
        </span>
      )}

      {errorMessage && (
        <span className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {errorMessage}
        </span>
      )}

      {isActive && (
        <Button
          variant="destructive"
          size="sm"
          onClick={handleStop}
          disabled={stopping}
          className="ml-auto"
        >
          {stopping ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Square className="h-4 w-4 mr-1" />
          )}
          Stop
        </Button>
      )}
    </div>
  );
}
