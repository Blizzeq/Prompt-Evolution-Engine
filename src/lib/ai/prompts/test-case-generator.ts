/**
 * Build a prompt that auto-generates test cases from a task description.
 * Used in Quick Mode when the user doesn't provide manual test cases.
 */
export function buildTestCaseGeneratorPrompt(
  taskDescription: string,
  userPrompt?: string,
  count: number = 5,
): string {
  return `You are a QA expert generating test cases for an AI prompt optimization system.

TASK: ${taskDescription}
${userPrompt ? `\nPROMPT BEING OPTIMIZED:\n"""${userPrompt}"""\n` : ""}

Generate exactly ${count} test cases as a JSON array. Each test case simulates a real user interacting with this prompt.

REQUIREMENTS:
1. "input" — a realistic user message/query that someone would actually send. Vary the phrasing, specificity, and angle across test cases.
2. "expectedOutput" — a SPECIFIC, VERIFIABLE description of what a good response MUST contain. List concrete elements (specific terms, structure, facts) rather than vague quality descriptors.
3. "weight" — always 1.0

DIVERSITY RULES (you MUST follow these):
- Test Case 1: Standard/happy path — typical user request
- Test Case 2: Specific constraint — user adds a particular requirement or limitation
- Test Case 3: Edge case — user asks something that tests the prompt's flexibility
- Test Case 4: Different phrasing — same core need expressed very differently
- Test Case 5: Detail-focused — user asks for something that requires the prompt to be thorough

BAD expectedOutput examples (too vague — DO NOT write like this):
- "A good, detailed response" ❌
- "A correct answer to the question" ❌
- "A well-structured plan" ❌

GOOD expectedOutput examples (specific, verifiable):
- "Response must contain: (1) three named exercises, (2) time for each in seconds, (3) mention of dynamic over static stretching" ✓
- "Must include at least 2 specific tools/libraries by name and a code example" ✓
- "Should list pros AND cons, with at least 3 of each" ✓

Respond with ONLY a JSON array, no other text:
[{"input": "...", "expectedOutput": "...", "weight": 1.0}, ...]`;
}
