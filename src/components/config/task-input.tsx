"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TaskInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function TaskInput({ value, onChange, error }: TaskInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="task-description">Task Summary</Label>
      <Textarea
        id="task-description"
        placeholder="Describe the task the prompt should solve."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className={error ? "border-destructive" : ""}
      />
      <div className="flex justify-between">
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Describe the task to optimize (10-2000 chars)
          </p>
        )}
        <span className="text-xs text-muted-foreground">
          {value.length}/2000
        </span>
      </div>
    </div>
  );
}
