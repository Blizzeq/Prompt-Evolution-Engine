import type { GemmaModelId, OllamaComputeMode } from "@/lib/engine/types";
import { AiClientError } from "@/lib/utils/errors";
import { callOllama } from "./providers/ollama";
import { callGoogleAI, createGoogleClient } from "./providers/google-ai";
import { callOpenRouter } from "./providers/openrouter";
import type { GoogleGenAI } from "@google/genai";

export interface AiClientConfig {
  provider: "ollama" | "google-ai-studio" | "openrouter";
  modelId: GemmaModelId;
  apiKey: string;
  ollamaBaseUrl: string;
  maxRetries: number;
  retryDelayMs: number;
  delayBetweenCalls: number;
  ollamaComputeMode: OllamaComputeMode;
  ollamaNumGpuLayers: number;
}

export interface GenerateOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface GenerateResult {
  text: string;
  tokensUsed: number;
  latencyMs: number;
  provider: string;
}

const DEFAULT_CONFIG: AiClientConfig = {
  provider: "ollama",
  modelId: "gemma4",
  apiKey: "",
  ollamaBaseUrl: "http://localhost:11434",
  maxRetries: 3,
  retryDelayMs: 2000,
  delayBetweenCalls: 0,
  ollamaComputeMode: "auto",
  ollamaNumGpuLayers: -1,
};

export class GemmaClient {
  private config: AiClientConfig;
  private googleClient: GoogleGenAI | null = null;
  private callCount = 0;
  private lastCallTime = 0;
  private abortController: AbortController;

  constructor(config: Partial<AiClientConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.abortController = new AbortController();
    if (this.config.provider === "google-ai-studio" && this.config.apiKey) {
      this.googleClient = createGoogleClient(this.config.apiKey);
    }
  }

  /** Abort all in-flight requests immediately. */
  abort(): void {
    this.abortController.abort();
  }

  /** Get the current abort signal for passing to providers. */
  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (this.abortController.signal.aborted) {
      throw new AiClientError("Client has been aborted");
    }

    await this.enforceRateLimit();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (this.abortController.signal.aborted) {
        throw new AiClientError("Client has been aborted");
      }

      try {
        const result = await this.callProvider(options);
        this.callCount++;
        return result;
      } catch (error) {
        if (this.abortController.signal.aborted) {
          throw new AiClientError("Client has been aborted");
        }

        lastError = error as Error;

        if (this.isRateLimitError(error)) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }

        if (attempt < this.config.maxRetries) {
          await this.sleep(this.config.retryDelayMs * (attempt + 1));
          continue;
        }
      }
    }

    throw new AiClientError(
      `Failed after ${this.config.maxRetries} retries: ${lastError?.message}`,
      lastError,
    );
  }

  private async callProvider(options: GenerateOptions): Promise<GenerateResult> {
    const signal = this.abortController.signal;
    switch (this.config.provider) {
      case "ollama":
        return callOllama(this.config, options, signal);
      case "google-ai-studio":
        if (!this.googleClient) throw new AiClientError("Google AI client not initialized");
        return callGoogleAI(this.googleClient, this.config, options);
      case "openrouter":
        return callOpenRouter(this.config, options, signal);
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.config.delayBetweenCalls) {
      await this.sleep(this.config.delayBetweenCalls - elapsed);
    }
    this.lastCallTime = Date.now();
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.message.includes("429");
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getCallCount(): number {
    return this.callCount;
  }

  getProvider(): string {
    return this.config.provider;
  }
}
