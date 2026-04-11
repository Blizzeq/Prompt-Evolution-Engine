// Environment configuration with sensible defaults

export function getConfig() {
  return {
    // AI Provider
    provider: (process.env.AI_PROVIDER ?? "ollama") as "ollama" | "google-ai-studio" | "openrouter",
    modelId: (process.env.MODEL_ID ?? "gemma4") as import("@/lib/engine/types").GemmaModelId,

    // Ollama
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",

    // API Keys
    googleAiApiKey: process.env.GOOGLE_AI_API_KEY ?? "",
    openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",

    // Rate Limiting
    delayBetweenCalls: parseInt(process.env.DELAY_BETWEEN_CALLS ?? "0", 10),

    // Database
    dbPath: process.env.DB_PATH ?? "./data/evolution.sqlite",
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
