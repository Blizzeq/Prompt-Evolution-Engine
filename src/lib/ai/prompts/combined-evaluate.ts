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

  return `You are a rigorous AI prompt evaluator. Analyze how well a prompt template would perform on specific test cases.

TASK DESCRIPTION: ${taskDescription}

PROMPT TEMPLATE BEING EVALUATED:
"""
${promptText}
"""

TEST CASES:
${casesText}

EVALUATION PROCESS — for each test case, do ALL three steps:

Step 1: SIMULATE — mentally execute the prompt template with the test input substituted for {input}. Write down what key elements the AI response would contain.

Step 2: COMPARE — check each element in the expected output against your simulated response:
- Which expected elements would be present?
- Which expected elements would be missing or wrong?
- Would there be any extra content not asked for?

Step 3: SCORE using 0.1 increments (use the FULL range, not just 0.0/0.2/0.4/0.6/0.8/1.0):
- 1.0 = Simulated response would match expected output perfectly
- 0.9 = All key content present, only trivial style differences
- 0.8 = Very close with minor format/wording differences
- 0.7 = Good but missing one specific element from expected output
- 0.6 = Covers main points but misses some expected elements
- 0.5 = Roughly half of expected elements would be covered
- 0.4 = Partially correct with significant gaps
- 0.3 = Poor coverage of expected output
- 0.2 = Mostly wrong or irrelevant
- 0.1 = Almost entirely wrong
- 0.0 = Completely wrong or would refuse

IMPORTANT SCORING RULES:
- If the prompt hardcodes specific details (e.g. age, height) that conflict with the test input, penalize: score <= 0.6
- If the prompt lacks instructions to handle a specific concern mentioned in the test input, penalize proportionally
- Count the concrete elements in expected output. Score = fraction of elements the prompt would produce.
- A prompt that "might" address something scores LOWER than one that explicitly instructs the AI to address it.

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "evaluations": {
    "${testCases[0]?.id ?? "tc_1"}": { "score": <number>, "reasoning": "<brief explanation>" }${testCases.length > 1 ? `,\n    ...` : ""}
  }
}`;
}
