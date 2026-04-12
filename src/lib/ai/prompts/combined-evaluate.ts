/**
 * Combined evaluation prompt — simulates execution + judges in a single LLM call.
 * Reduces API calls from N+1 (N exec + 1 judge) to just 1 per prompt.
 * Designed for rate-limited cloud providers (OpenRouter free tier, etc.)
 */

export function buildCombinedEvaluatePrompt(
  taskDescription: string,
  promptText: string,
  testCases: Array<{
    id: string;
    input: string;
    expectedOutput: string;
  }>,
): string {
  const casesText = testCases
    .map(
      (tc, i) =>
        `--- Test Case ${i + 1} (id: ${tc.id}) ---
Input: ${tc.input}
Expected output: ${tc.expectedOutput}`,
    )
    .join("\n\n");

  return `You are an expert AI evaluator. Your job is to assess the quality of an AI prompt template.

TASK DESCRIPTION: ${taskDescription}

PROMPT TEMPLATE BEING EVALUATED:
"""
${promptText}
"""

TEST CASES:
${casesText}

INSTRUCTIONS:
For each test case:
1. Consider what response an AI following the above prompt template would generate when given the test input. The template may contain {input} as a placeholder for the test input.
2. Compare that likely response to the expected output.
3. Score from 0.0 to 1.0:
   - 1.0 = The prompt would produce a response perfectly matching the expected output
   - 0.8 = Very close with minor differences in style/format
   - 0.6 = Mostly correct but missing some elements
   - 0.4 = Partially correct with significant gaps
   - 0.2 = The prompt would likely produce a poor response
   - 0.0 = The prompt is irrelevant or would produce completely wrong output

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "evaluations": {
    "${testCases[0]?.id ?? "tc_1"}": { "score": <number>, "reasoning": "<brief explanation>" }${testCases.length > 1 ? `,\n    ...` : ""}
  }
}`;
}
