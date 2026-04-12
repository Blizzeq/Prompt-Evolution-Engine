"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Square,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import type { RunStatus, StopReason } from "@/lib/engine/types";

interface RunControlsProps {
  runId: string;
  status: RunStatus;
  stopReason: StopReason | null;
  errorMessage: string | null;
}

const stopReasonLabels: Record<StopReason, string> = {
  "user-stopped": "Stopped by user",
  "early-convergence": "Early convergence",
  "fitness-reached": "Fitness threshold reached",
  "api-error": "API error",
};

function StatusBadge({ status }: { status: RunStatus }) {
  const base = "gap-1.5 px-2.5 py-1 text-[11px]";

  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className={`${base} bg-success/10 text-success border-success/20`}>
          <CheckCircle2 className="h-3 w-3" /> Completed
        </Badge>
      );
    case "running":
      return (
        <Badge variant="outline" className={`${base} bg-primary/10 text-primary border-primary/20`}>
          <Activity className="h-3 w-3 animate-pulse" /> Running
        </Badge>
      );
    case "initializing":
      return (
        <Badge variant="outline" className={`${base} bg-primary/10 text-primary border-primary/20`}>
          <Loader2 className="h-3 w-3 animate-spin" /> Initializing
        </Badge>
      );
    case "stopped":
      return (
        <Badge variant="secondary" className={base}>
          <Square className="h-3 w-3" /> Stopped
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className={`${base} bg-destructive/10 text-destructive border-destructive/20`}>
          <XCircle className="h-3 w-3" /> Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className={base}>
          <Clock className="h-3 w-3" /> {status}
        </Badge>
      );
  }
}

export function RunControls({
  runId,
  status,
  stopReason,
  errorMessage,
}: RunControlsProps) {
  const [stopping, setStopping] = useState(false);
  const isActive = status === "running" || status === "initializing";

  const handleStop = async () => {
    setStopping(true);
    try {
      const res = await fetch(`/api/evolution/${runId}/stop`, {
        method: "POST",
      });
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
    <div className="flex items-center gap-3 flex-wrap">
      <StatusBadge status={status} />

      {stopReason && (
        <span className="text-[11px] text-muted-foreground">
          {stopReasonLabels[stopReason]}
        </span>
      )}

      {errorMessage && (
        <span className="text-[11px] text-destructive flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {errorMessage}
        </span>
      )}

      {isActive && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleStop}
          disabled={stopping}
          className="ml-auto gap-1.5 border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          {stopping ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
          Stop Run
        </Button>
      )}
    </div>
  );
}
