import type { MutationType } from "@/lib/engine/types";

const MUTATION_INSTRUCTIONS: Record<MutationType, string> = {
  rephrase:
    "REPHRASE the prompt — reword the instructions using different vocabulary and sentence structure while preserving the core meaning. Change at least 50% of the words.",

  "add-constraint":
    "ADD A CONSTRAINT — add one specific restriction or requirement that could improve output quality. Examples: output length limit, format requirement, exclusion rule, specificity requirement.",

  "remove-constraint":
    "REMOVE A CONSTRAINT — identify and remove one restriction or requirement that might be limiting performance. Simplify the prompt. If the prompt is already minimal, remove the least essential instruction.",

  reorder:
    "REORDER — rearrange the instructions in a different order. Research shows instruction order affects LLM performance. Try putting the most important constraint first or last.",

  "tone-shift":
    "SHIFT THE TONE — if the prompt is formal, make it conversational. If casual, make it professional and precise. If neutral, make it authoritative. The core instructions must remain the same.",

  "add-example":
    "ADD A FEW-SHOT EXAMPLE — insert one concrete input/output example that demonstrates the expected behavior. Place it naturally within the prompt.",

  "meta-mutation":
    "IMPROVE THIS PROMPT — you have full creative freedom. Analyze what could be improved and make ONE meaningful change. Consider: clarity, specificity, structure, missing instructions, or unnecessary complexity.",
};

export function buildMutationPrompt(
  taskDescription: string,
  prompt: string,
  mutationType: MutationType,
  fitness: number,
): string {
  return `You are a prompt engineer performing a MUTATION operation.

TASK: ${taskDescription}

ORIGINAL PROMPT (fitness: ${fitness.toFixed(3)}):
"""
${prompt}
"""

MUTATION TYPE: ${mutationType}
${MUTATION_INSTRUCTIONS[mutationType]}

Rules:
1. Make EXACTLY ONE type of change (the mutation type above)
2. The change should be meaningful but not radical — think "fine-tuning", not "rewrite"
3. The result must still be a valid, complete prompt for the task
4. Include the {input} placeholder
5. Keep length between 20–200 words

Respond with ONLY the mutated prompt text. No explanation.`;
}
