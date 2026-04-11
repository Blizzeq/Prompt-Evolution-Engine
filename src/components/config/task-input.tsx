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
      <Label htmlFor="task-description">Task Description</Label>
      <Textarea
        id="task-description"
        placeholder="Describe what the prompt should do. E.g., 'Classify the sentiment of text as positive, negative, or neutral.'"
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
            Describe the task your prompt should solve (10-2000 chars)
          </p>
        )}
        <span className="text-xs text-muted-foreground">
          {value.length}/2000
        </span>
      </div>
    </div>
  );
}
