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

Rate the actual response on a scale of 0.0 to 1.0. Use the FULL range with 0.1 increments — do NOT round to 0.2 steps:
- 1.0 = Flawless match — content, format, and intent perfectly align with expected output
- 0.9 = Excellent — all key content present, only trivial style/wording differences
- 0.8 = Very good — correct content with minor format or phrasing differences
- 0.7 = Good — mostly correct but missing one minor element or has a small inaccuracy
- 0.6 = Adequate — covers the main points but misses some elements from expected output
- 0.5 = Mixed — roughly half correct, half missing or inaccurate
- 0.4 = Below average — partially correct but significant gaps or errors
- 0.3 = Poor — attempts the task but gets most things wrong
- 0.2 = Very poor — only tangentially related to expected output
- 0.1 = Minimal — almost entirely wrong but shows some task awareness
- 0.0 = Completely wrong, off-topic, or refused to answer

Scoring criteria (weighted by importance):
1. Factual correctness — does the response contain the same information as expected? (40%)
2. Completeness — does it cover ALL elements mentioned in expected output? (30%)
3. Format compliance — does it follow format/structure instructions? (20%)
4. Precision — is it focused without unnecessary filler? (10%)

Be strict: a response that covers 3 out of 4 expected elements should score ~0.7, not 0.8.

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

For EACH test case, rate 0.0–1.0 using 0.1 increments (NOT just 0.0/0.2/0.4/0.6/0.8/1.0):
- 1.0 = Flawless match  |  0.9 = Excellent, trivial differences  |  0.8 = Very good, minor format issues
- 0.7 = Good, missing one minor element  |  0.6 = Adequate, some missing elements  |  0.5 = Mixed results
- 0.4 = Below average, significant gaps  |  0.3 = Poor  |  0.2 = Very poor  |  0.1 = Minimal  |  0.0 = Wrong

Scoring criteria: Factual correctness (40%), Completeness (30%), Format compliance (20%), Precision (10%).
Be strict: missing 1 of 4 expected elements = ~0.7, not 0.8.

Respond with ONLY a JSON object mapping test case IDs to scores and reasoning:
{
  "evaluations": {
    "<id>": { "score": <number>, "reasoning": "<one sentence>" },
    ...
  }
}`;
}
