"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TaskPreset } from "@/lib/engine/types";
import {
  MessageCircle,
  FileText,
  Search,
  Bug,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  MessageCircle,
  FileText,
  Search,
  Bug,
};

interface PresetSelectorProps {
  presets: TaskPreset[];
  selectedId: string | null;
  onSelect: (preset: TaskPreset) => void;
}

export function PresetSelector({
  presets,
  selectedId,
  onSelect,
}: PresetSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Presets</h2>
        <p className="text-sm text-muted-foreground">
          Load a starting template or configure the run manually.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {presets.map((preset) => {
          const Icon = ICON_MAP[preset.icon];
          const isSelected = selectedId === preset.id;

          return (
            <Card
              key={preset.id}
              className={`flex flex-col p-4 cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm ${
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : ""
              }`}
              onClick={() => onSelect(preset)}
            >
              <div className="flex items-start gap-3">
                {Icon && (
                  <div className="rounded-md bg-muted p-2 shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-medium text-sm leading-tight">
                    {preset.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {preset.description}
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5 mt-auto pt-3">
                <Badge variant="secondary" className="text-[10px]">
                  {preset.testCases.length} tests
                </Badge>
                {preset.seedPrompts && preset.seedPrompts.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {preset.seedPrompts.length} seed
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
