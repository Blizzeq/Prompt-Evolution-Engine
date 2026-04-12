"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileInput } from "lucide-react";

interface OriginalPromptProps {
  userPrompt: string | null;
  taskDescription: string;
}

export function OriginalPrompt({ userPrompt, taskDescription }: OriginalPromptProps) {
  if (!userPrompt && !taskDescription) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileInput className="h-4 w-4" />
          Original Input
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {userPrompt && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="outline" className="text-xs">Input Prompt</Badge>
            </div>
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/50 rounded-md p-3 max-h-40 overflow-y-auto">
              {userPrompt}
            </pre>
          </div>
        )}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="text-xs">Task / Context</Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {taskDescription}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
