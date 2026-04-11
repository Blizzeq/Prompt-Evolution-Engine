"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

export interface TestCaseRow {
  input: string;
  expectedOutput: string;
  weight: number;
}

interface TestCaseEditorProps {
  testCases: TestCaseRow[];
  onChange: (testCases: TestCaseRow[]) => void;
  error?: string;
}

export function TestCaseEditor({
  testCases,
  onChange,
  error,
}: TestCaseEditorProps) {
  const addTestCase = () => {
    if (testCases.length >= 20) return;
    onChange([...testCases, { input: "", expectedOutput: "", weight: 1.0 }]);
  };

  const removeTestCase = (index: number) => {
    onChange(testCases.filter((_, i) => i !== index));
  };

  const updateTestCase = (
    index: number,
    field: keyof TestCaseRow,
    value: string | number,
  ) => {
    const updated = [...testCases];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Test Cases</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Input/output pairs to evaluate prompts against (3-20 required)
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTestCase}
          disabled={testCases.length >= 20}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="space-y-3">
        {testCases.map((tc, index) => (
          <div
            key={index}
            className="rounded-lg border bg-card p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Test Case {index + 1}
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground">
                    Weight
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={tc.weight}
                    onChange={(e) =>
                      updateTestCase(
                        index,
                        "weight",
                        parseFloat(e.target.value) || 1.0,
                      )
                    }
                    className="h-7 w-16 text-xs"
                  />
                </div>
                {testCases.length > 3 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeTestCase(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              placeholder="Input text..."
              value={tc.input}
              onChange={(e) => updateTestCase(index, "input", e.target.value)}
              rows={2}
              className="text-sm"
            />
            <Textarea
              placeholder="Expected output..."
              value={tc.expectedOutput}
              onChange={(e) =>
                updateTestCase(index, "expectedOutput", e.target.value)
              }
              rows={2}
              className="text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
