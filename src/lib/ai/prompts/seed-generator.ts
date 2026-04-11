export function buildSeedGeneratorPrompt(
  taskDescription: string,
  existingSeedPrompts: string[],
  count: number,
): string {
  return `You are an expert prompt engineer. Your job is to generate diverse initial prompts for a given task.

TASK DESCRIPTION:
${taskDescription}

${
  existingSeedPrompts.length > 0
    ? `
USER-PROVIDED SEED PROMPTS (already in population — generate DIFFERENT approaches):
${existingSeedPrompts.map((p, i) => `${i + 1}. "${p}"`).join("\n")}
`
    : ""
}

Generate exactly ${count} NEW prompts for this task. Each prompt must:
1. Be a complete instruction that can be prepended to user input
2. Use a DIFFERENT approach/style/structure than the others
3. Include a {input} placeholder where the user's input will be inserted
4. Be between 20–200 words

Diversity strategies to use across your ${count} prompts:
- Vary formality (casual vs. professional)
- Vary structure (single paragraph vs. step-by-step)
- Vary specificity (broad vs. highly constrained)
- Vary output format instructions (free text vs. structured)
- Include/exclude few-shot examples
- Include/exclude chain-of-thought instructions

Respond with a JSON array of exactly ${count} strings. Nothing else.

Example response format:
["prompt 1 text here with {input} placeholder", "prompt 2 text here with {input} placeholder"]`;
}
