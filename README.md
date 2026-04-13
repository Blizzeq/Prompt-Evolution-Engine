# Prompt Evolution Engine

An open-source web application that applies **evolutionary algorithms** to automatically optimize LLM prompts. Define a task, provide test cases (or let the system generate them), and watch evolution find a better prompt — generation by generation.

Built on research from [EvoPrompt (ICLR 2024)](https://arxiv.org/abs/2309.08532) and [OPRO (Google DeepMind)](https://arxiv.org/abs/2309.03409).

## How It Works

```
Seed Population ──> Evaluate (LLM-as-Judge) ──> Select (Tournament)
       ^                                              |
       |                                              v
   Next Gen <── Elite carry-forward <── Crossover + Mutation
```

1. **Define** your task and provide test cases — or use Quick Mode with a structured 6-field prompt builder
2. **Seed** an initial population from your prompt + LLM-generated variations
3. **Evaluate** each prompt against all test cases, scored by an LLM judge (0.0-1.0)
4. **Select** the fittest prompts via tournament selection
5. **Reproduce** — section-aware crossover combines parents; 7 mutation operators introduce variation
6. **Repeat** with adaptive mutation rates and elite re-evaluation for N generations
7. **Result** — the winning prompt with fitness metrics and full genealogy visualization

## Features

- **Genetic Algorithm** with tournament selection, elitism, and adaptive mutation rates
- **7 mutation operators** — rephrase, add/remove constraints, reorder, tone shift, add examples, meta-mutation
- **3 crossover strategies** — simple, section-aware, differential
- **LLM-as-Judge evaluation** with weighted scoring rubric and combined eval mode (1 API call per prompt)
- **Quick Mode** — structured 6-field prompt builder (Persona, Task, Steps, Context, Goal, Format) with auto-generated test cases
- **Advanced Mode** — full control over population size, generations, mutation rate, EA variant, and evaluation method
- **Real-time dashboard** — live fitness chart, prompt genealogy DAG, generation-by-generation population table
- **Multi-provider** — Ollama (local, zero cost), Google AI Studio, OpenRouter (350+ models)
- **Run history** — browse, compare, and revisit past evolution runs

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui, Framer Motion |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| State | Zustand 5 |
| Visualization | Recharts, React Flow + dagre |
| AI Providers | Ollama, Google AI Studio, OpenRouter |
| Validation | Zod 4 |
| Testing | Vitest |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- [Ollama](https://ollama.com) (for local inference) or a Google AI Studio / OpenRouter API key

### Setup

```bash
git clone https://github.com/Blizzeq/Prompt-Evolution-Engine.git
cd Prompt-Evolution-Engine

pnpm install

cp .env.local.example .env.local
# Edit .env.local with your provider config

pnpm drizzle-kit migrate

pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Provider Setup

**Ollama (local, recommended for development)**

```bash
ollama serve
ollama pull gemma4    # Gemma 4 26B A4B — MoE, activates 4B params/token
```

**Google AI Studio** — set `GOOGLE_AI_API_KEY` in `.env.local` ([get key](https://aistudio.google.com))

**OpenRouter** — set `OPENROUTER_API_KEY` in `.env.local` ([get key](https://openrouter.ai))

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `ollama` | `ollama`, `google-ai-studio`, or `openrouter` |
| `MODEL_ID` | `gemma4` | Model identifier for the selected provider |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `GOOGLE_AI_API_KEY` | — | Google AI Studio API key |
| `OPENROUTER_API_KEY` | — | OpenRouter API key |
| `DELAY_BETWEEN_CALLS` | `0` | Rate limit delay in ms (0 for Ollama, ~4200 for Google AI) |
| `ALLOW_REMOTE_ACCESS` | `true` | Set to `false` to restrict to localhost only |

## Project Structure

```
src/
  app/                      # Next.js App Router
    api/evolution/           #   Start, stop, stream, get/delete runs
    api/runs/                #   List all runs
    api/health/              #   Provider health check
    new/                     #   Quick Mode + Advanced Mode config
    run/[id]/                #   Real-time evolution dashboard
    history/                 #   Past runs browser
  components/
    config/                  # Provider selector, presets, parameter controls
    dashboard/               # Fitness chart, genealogy DAG, population table, results
    layout/                  # App shell, theme toggle
    ui/                      # shadcn/ui primitives
  lib/
    ai/                      # AI client, provider adapters, evaluation prompts
    db/                      # Drizzle schema, queries, migrations
    engine/                  # Evolution loop, selection, crossover, mutation, fitness
    utils/                   # SSE helpers, config, security
  stores/                    # Zustand stores
  hooks/                     # SSE stream, run data hooks
```

## API

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/evolution/start` | Start a new evolution run |
| `GET` | `/api/evolution/[id]` | Get full run state + prompts |
| `DELETE` | `/api/evolution/[id]` | Delete a run |
| `POST` | `/api/evolution/[id]/stop` | Stop a running evolution |
| `GET` | `/api/evolution/[id]/stream` | SSE stream of live events |
| `GET` | `/api/runs` | List all runs |
| `GET` | `/api/health` | Provider connectivity check |

## Testing

```bash
pnpm test
```

## Security

- API routes enforce trusted-origin checks and per-route rate limiting
- API keys provided via the UI are used in-memory only, never persisted
- Remote access is enabled by default — add your own auth layer if exposing publicly
- Remote Ollama hosts can be allowlisted via `OLLAMA_ALLOWED_HOSTS`

## Research References

- [EvoPrompt](https://arxiv.org/abs/2309.08532) — Connecting LLMs with Evolutionary Algorithms (ICLR 2024)
- [OPRO](https://arxiv.org/abs/2309.03409) — Optimization by PROmpting (Google DeepMind)
- [DSPy MIPROv2](https://arxiv.org/abs/2406.11695) — Bayesian prompt optimization (Stanford NLP)
- [GAAPO](https://doi.org/10.3389/frai.2025.1504587) — Genetic Algorithm-based Automated Prompt Optimization

## License

MIT
