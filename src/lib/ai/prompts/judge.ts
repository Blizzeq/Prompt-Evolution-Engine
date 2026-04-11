export function buildJudgePrompt(
  taskDescription: string,
  promptText: string,
  testInput: string,
  expectedOutput: string,
  actualResponse: string,
): string {
  return `You are an impartial judge evaluating how well an AI prompt performs on a specific task.

TASK DESCRIPTION: ${taskDescription}

THE PROMPT BEING EVALUATED:
"""
${promptText}
"""

TEST INPUT:
"""
${testInput}
"""

EXPECTED OUTPUT:
"""
${expectedOutput}
"""

ACTUAL RESPONSE (from the prompt):
"""
${actualResponse}
"""

Rate the actual response on a scale of 0.0 to 1.0:
- 1.0 = Perfect match to expected output (content, format, and intent)
- 0.8 = Correct content with minor format/style differences
- 0.6 = Mostly correct with some inaccuracies or missing elements
- 0.4 = Partially correct but significant issues
- 0.2 = Attempted the task but largely wrong
- 0.0 = Completely wrong, off-topic, or refused to answer

Consider:
1. Correctness — does it match the expected output?
2. Format compliance — does it follow any format instructions?
3. Completeness — does it address all aspects?
4. Conciseness — is it appropriately concise?

Respond with ONLY a JSON object: {"score": <number>, "reasoning": "<one sentence>"}`;
}

export function buildBatchedJudgePrompt(
  taskDescription: string,
  promptText: string,
  testCases: Array<{
    id: string;
    input: string;
    expectedOutput: string;
    actualResponse: string;
  }>,
): string {
  const casesText = testCases
    .map(
      (tc, i) =>
        `--- Test Case ${i + 1} (id: ${tc.id}) ---
Input: ${tc.input}
Expected: ${tc.expectedOutput}
Actual response: ${tc.actualResponse}`,
    )
    .join("\n\n");

  return `You are an impartial judge. Evaluate how well an AI prompt performs across multiple test cases.

TASK: ${taskDescription}

PROMPT BEING EVALUATED:
"""
${promptText}
"""

TEST CASES AND RESPONSES:
${casesText}

For EACH test case, rate 0.0–1.0:
- 1.0 = Perfect match  |  0.8 = Minor differences  |  0.6 = Mostly correct
- 0.4 = Partially correct  |  0.2 = Largely wrong  |  0.0 = Completely wrong

Respond with ONLY a JSON object mapping test case IDs to scores and reasoning:
{
  "evaluations": {
    "<id>": { "score": <number>, "reasoning": "<one sentence>" },
    ...
  }
}`;
}
