"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileInput } from "lucide-react";

interface OriginalPromptProps {
  userPrompt: string | null;
  taskDescription: string;
}

export function OriginalPrompt({
  userPrompt,
  taskDescription,
}: OriginalPromptProps) {
  if (!userPrompt && !taskDescription) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <FileInput className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          Run brief
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {userPrompt && (
          <div>
            <Badge variant="outline" className="text-[11px] mb-2">
              Input prompt
            </Badge>
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/40 rounded-xl p-3 max-h-40 overflow-y-auto border border-border/50 leading-relaxed">
              {userPrompt}
            </pre>
          </div>
        )}
        <div>
          <Badge variant="outline" className="text-[11px] mb-2">
            Task context
          </Badge>
          <p className="text-sm text-muted-foreground leading-relaxed bg-muted/40 rounded-xl p-3 max-h-40 overflow-y-auto border border-border/50">
            {taskDescription}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
