"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

interface SeedPromptsProps {
  seeds: string[];
  onChange: (seeds: string[]) => void;
}

export function SeedPrompts({ seeds, onChange }: SeedPromptsProps) {
  const addSeed = () => {
    if (seeds.length >= 4) return;
    onChange([...seeds, ""]);
  };

  const removeSeed = (index: number) => {
    onChange(seeds.filter((_, i) => i !== index));
  };

  const updateSeed = (index: number, value: string) => {
    const updated = [...seeds];
    updated[index] = value;
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Seed Prompts</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Optional starting prompts. Each must contain{" "}
            <code className="text-[10px] bg-muted px-1 rounded">
              {"{input}"}
            </code>. Up to 4.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSeed}
          disabled={seeds.length >= 4}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>

      {seeds.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-2">
          No seed prompts added. The initial population will be generated automatically.
        </p>
      )}

      <div className="space-y-2">
        {seeds.map((seed, index) => {
          const hasPlaceholder = seed.includes("{input}");

          return (
            <div key={index} className="relative">
              <Textarea
                placeholder={`Seed prompt ${index + 1}... must include {input} placeholder`}
                value={seed}
                onChange={(e) => updateSeed(index, e.target.value)}
                rows={3}
                className={`text-sm pr-10 font-mono ${
                  seed.length > 0 && !hasPlaceholder
                    ? "border-destructive"
                    : ""
                }`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-1.5 right-1.5 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeSeed(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              {seed.length > 0 && !hasPlaceholder && (
                <p className="text-xs text-destructive mt-1">
                  Must contain {"{input}"} placeholder
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
