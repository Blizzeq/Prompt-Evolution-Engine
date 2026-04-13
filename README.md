# Prompt Evolution Engine

Applies **evolutionary algorithms** to automatically optimize LLM prompts. Define a task, provide test cases (or let the system generate them), and watch evolution find a better prompt.

Based on [EvoPrompt (ICLR 2024)](https://arxiv.org/abs/2309.08532) and [OPRO (Google DeepMind)](https://arxiv.org/abs/2309.03409).

**Live demo:** [prompt-evolution-engine.vercel.app](https://prompt-evolution-engine.vercel.app)

> **Note:** The live demo is a static preview only. The evolution engine requires a running backend with SQLite — clone the repo and run locally with `pnpm dev` to use the full functionality.

## How It Works

1. **Seed** a population of prompts from your input + LLM-generated variations
2. **Evaluate** each prompt against test cases using an LLM-as-Judge (scored 0.0-1.0)
3. **Select** the fittest via tournament selection
4. **Crossover + Mutate** to create the next generation (7 mutation operators, section-aware crossover)
5. **Repeat** with adaptive mutation and elite re-evaluation
6. **Result** — the best prompt with fitness metrics and full genealogy DAG

## Key Features

- **Quick Mode** — structured 6-field prompt builder with auto-generated test cases
- **Advanced Mode** — full control over population, generations, mutation rate, EA variant
- **Real-time dashboard** — live fitness chart, prompt genealogy DAG, population table
- **Multi-provider** — Ollama (local), Google AI Studio, OpenRouter

## Tech Stack

Next.js 16 | React 19 | TypeScript | Tailwind CSS 4 | shadcn/ui | SQLite + Drizzle ORM | Zustand | Recharts | React Flow | Zod | Vitest

## Quick Start

```bash
git clone https://github.com/Blizzeq/Prompt-Evolution-Engine.git
cd Prompt-Evolution-Engine

pnpm install
cp .env.local.example .env.local   # configure your provider
pnpm drizzle-kit migrate
pnpm dev
```

Requires Node.js 20+ and pnpm. For local inference, install [Ollama](https://ollama.com) and pull a model:

```bash
ollama serve
ollama pull gemma4
```

For cloud providers, set `GOOGLE_AI_API_KEY` or `OPENROUTER_API_KEY` in `.env.local`.

## Research References

- [EvoPrompt](https://arxiv.org/abs/2309.08532) — LLMs with Evolutionary Algorithms (ICLR 2024)
- [OPRO](https://arxiv.org/abs/2309.03409) — Optimization by PROmpting (Google DeepMind)
- [DSPy MIPROv2](https://arxiv.org/abs/2406.11695) — Bayesian prompt optimization (Stanford NLP)
- [GAAPO](https://doi.org/10.3389/frai.2025.1504587) — GA-based Automated Prompt Optimization

## License

MIT
