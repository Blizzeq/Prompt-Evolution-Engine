/**
 * Build a prompt that auto-generates test cases from a task description.
 * Used in Quick Mode when the user doesn't provide manual test cases.
 */
export function buildTestCaseGeneratorPrompt(
  taskDescription: string,
  userPrompt?: string,
  count: number = 5,
): string {
  return `Generate ${count} test cases for evaluating this AI prompt task.

Task: ${taskDescription}
${userPrompt ? `\nPrompt to optimize: ${userPrompt}` : ""}

Return a JSON array. Each object must have "input" (test input string), "expectedOutput" (ideal response string), and "weight" (number, use 1.0).

Requirements:
- Inputs must be realistic examples someone would actually use
- Expected outputs must be specific and verifiable
- Include easy, medium, and hard cases
- Keep inputs and outputs short and concrete

JSON array only, no other text:`;
}
