// Environment configuration with sensible defaults

export function getConfig() {
  const ollamaAllowedHosts = (process.env.OLLAMA_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return {
    // AI Provider
    provider: (process.env.AI_PROVIDER ?? "ollama") as "ollama" | "google-ai-studio" | "openrouter",
    modelId: process.env.MODEL_ID ?? "gemini-2.5-flash",

    // Ollama
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    ollamaAllowedHosts,

    // API Keys
    googleAiApiKey: process.env.GOOGLE_AI_API_KEY ?? "",
    openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",

    // Security
    allowRemoteAccess: process.env.ALLOW_REMOTE_ACCESS !== "false",

    // Rate Limiting
    delayBetweenCalls: parseInt(process.env.DELAY_BETWEEN_CALLS ?? "0", 10),

    // Database
    dbPath: process.env.DB_PATH ?? "./data/evolution.sqlite",
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
