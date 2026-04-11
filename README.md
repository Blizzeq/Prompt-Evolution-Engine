# Prompt Evolution Engine

A local-first web application that applies **evolutionary algorithms** (Genetic Algorithms, Differential Evolution) to automatically optimize LLM prompts. Based on research from [EvoPrompt (ICLR 2024)](https://arxiv.org/abs/2309.08532) and [OPRO (Google DeepMind)](https://arxiv.org/abs/2309.03409).

Define a task, provide test cases, and let evolution find the best prompt.

## Features

- **Genetic Algorithm & Differential Evolution** — selection, crossover, and mutation operators adapted for natural language
- **7 mutation types** — rephrase, add/remove constraints, reorder, tone shift, add examples, meta-mutation
- **3 crossover strategies** — simple, section-aware, differential
- **LLM-as-Judge evaluation** — automated fitness scoring against user-defined test cases
- **Real-time dashboard** — live fitness chart, generation table, progress tracking via SSE
- **Local-first** — run with Ollama locally, or connect to Google AI Studio / OpenRouter
- **GPU/CPU control** — auto, GPU, CPU, or hybrid compute modes for Ollama
- **Run history** — browse, view, and delete past evolution runs

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui v4 |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| State | Zustand 5 |
| Charts | Recharts |
| AI Providers | Ollama, Google AI Studio, OpenRouter |
| Validation | Zod |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- [Ollama](https://ollama.com) (for local inference) or a Google AI Studio / OpenRouter API key

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/prompt-evolution-engine.git
cd prompt-evolution-engine

# Install dependencies
pnpm install

# Copy environment template
cp .env.local.example .env.local

# Initialize the database
pnpm drizzle-kit generate
pnpm drizzle-kit migrate

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Using Ollama

```bash
# Install and start Ollama
ollama serve

# Pull Gemma 4 (recommended)
ollama pull gemma4
```

### Using Google AI Studio

Set `GOOGLE_AI_API_KEY` in `.env.local` with your API key from [Google AI Studio](https://aistudio.google.com).

### Using OpenRouter

Set `OPENROUTER_API_KEY` in `.env.local` with your API key from [OpenRouter](https://openrouter.ai).

## How It Works

1. **Configure** — select a preset task or define your own with test cases
2. **Initialize** — seed population is generated from user prompts + LLM-generated variations
3. **Evaluate** — each prompt is tested against all test cases, scored by an LLM judge
4. **Select** — tournament selection picks the fittest prompts as parents
5. **Reproduce** — crossover combines parent prompts; mutation introduces variation
6. **Repeat** — elite prompts carry forward; process repeats for N generations
7. **Result** — the winning prompt is displayed with fitness improvement metrics

## Project Structure

```
src/
  app/                    # Next.js App Router pages & API routes
    api/
      evolution/          # Start, stop, stream, get run data
      runs/               # List all runs
      health/             # Provider health check
    new/                  # Configuration page
    run/[id]/             # Real-time dashboard
    history/              # Past runs
  components/
    config/               # Configuration form components
    dashboard/            # Run dashboard components
    layout/               # Header, theme toggle
    ui/                   # shadcn/ui components
  lib/
    ai/                   # AI client, providers, meta-prompts
    db/                   # Drizzle schema, queries, client
    engine/               # Evolution loop, operators, types
    utils/                # SSE, errors, config
  stores/                 # Zustand state management
  hooks/                  # Custom React hooks
```

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/evolution/start` | Start a new evolution run |
| `GET` | `/api/evolution/[id]` | Get full run state |
| `DELETE` | `/api/evolution/[id]` | Delete a run |
| `POST` | `/api/evolution/[id]/stop` | Stop a running evolution |
| `GET` | `/api/evolution/[id]/stream` | SSE stream of evolution events |
| `GET` | `/api/runs` | List all runs |
| `GET` | `/api/health` | Provider health check |

## License

MIT
