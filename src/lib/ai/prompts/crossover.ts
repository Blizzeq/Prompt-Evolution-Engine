export function buildSimpleCrossoverPrompt(
  taskDescription: string,
  parentA: { text: string; fitness: number },
  parentB: { text: string; fitness: number },
): string {
  return `You are a prompt engineer performing CROSSOVER — combining two effective prompts into a superior child prompt.

TASK: ${taskDescription}

PARENT A (fitness: ${parentA.fitness.toFixed(3)}):
"""
${parentA.text}
"""

PARENT B (fitness: ${parentB.fitness.toFixed(3)}):
"""
${parentB.text}
"""

Create ONE new prompt that intelligently combines the best elements of both parents.

Rules:
1. Identify what makes each parent effective (structure, constraints, tone, examples)
2. Combine these strengths — don't just concatenate
3. The child must be a coherent, standalone prompt
4. Include the {input} placeholder where user input goes
5. Keep length between 20–200 words
6. The child should be DIFFERENT from both parents, not a copy of either

Respond with ONLY the new prompt text. No explanation, no quotes, no prefix.`;
}

export function buildSectionAwareCrossoverPrompt(
  taskDescription: string,
  parentA: { text: string; fitness: number },
  parentB: { text: string; fitness: number },
): string {
  return `You are a prompt engineer performing SECTION-AWARE CROSSOVER.

TASK: ${taskDescription}

PARENT A (fitness: ${parentA.fitness.toFixed(3)}):
"""
${parentA.text}
"""

PARENT B (fitness: ${parentB.fitness.toFixed(3)}):
"""
${parentB.text}
"""

Step 1: Decompose each parent into functional sections (e.g., role definition, task instruction, constraints, output format, examples).
Step 2: For each section type, pick the better version from whichever parent.
Step 3: Assemble a new coherent prompt from the best sections.

Rules:
- The result must be a single coherent prompt, not a Frankenstein
- Include {input} placeholder
- 20–200 words
- Must be meaningfully different from both parents

Respond with ONLY the new prompt text.`;
}

export function buildDifferentialEvolutionPrompt(
  taskDescription: string,
  base: { text: string; fitness: number },
  diff1: { text: string; fitness: number },
  diff2: { text: string; fitness: number },
): string {
  return `You are performing DIFFERENTIAL EVOLUTION on prompts.

TASK: ${taskDescription}

In differential evolution, we create a new candidate from three existing prompts:
- BASE prompt (the foundation)
- DIFF1 and DIFF2 (their "difference" guides the mutation direction)

BASE (fitness: ${base.fitness.toFixed(3)}):
"""
${base.text}
"""

DIFF1 (fitness: ${diff1.fitness.toFixed(3)}):
"""
${diff1.text}
"""

DIFF2 (fitness: ${diff2.fitness.toFixed(3)}):
"""
${diff2.text}
"""

Your job: Take the BASE prompt and modify it in the DIRECTION of what makes DIFF1 different from DIFF2. Think of it as: new = BASE + (DIFF1 - DIFF2).

Concretely:
1. Identify what DIFF1 does that DIFF2 doesn't (unique strategies, structures, constraints)
2. Apply those differences to the BASE prompt
3. The result should be a new coherent prompt

Rules:
- Include {input} placeholder
- 20–200 words
- Must be meaningfully different from BASE

Respond with ONLY the new prompt text.`;
}
