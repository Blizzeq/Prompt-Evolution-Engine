import type { ModelId, OllamaComputeMode } from "@/lib/engine/types";
import { AiClientError, PermanentRateLimitError } from "@/lib/utils/errors";
import { callOllama } from "./providers/ollama";
import { callGoogleAI, createGoogleClient } from "./providers/google-ai";
import { callOpenRouter } from "./providers/openrouter";
import type { GoogleGenAI } from "@google/genai";

export interface AiClientConfig {
  provider: "ollama" | "google-ai-studio" | "openrouter";
  modelId: ModelId;
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
  modelId: "gemini-2.5-flash",
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
  private totalTokensUsed = 0;
  private abortController: AbortController;

  // Concurrency control — cloud providers run parallel, Ollama is sequential
  private maxConcurrency: number;
  private activeRequests = 0;
  private waitQueue: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
  private scheduleQueue: Promise<void> = Promise.resolve();
  private nextRequestNotBefore = 0;

  constructor(config: Partial<AiClientConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.abortController = new AbortController();

    // Cloud providers handle parallel requests; Ollama processes one at a time
    this.maxConcurrency = this.config.provider === "ollama" ? 1 : 5;

    if (this.config.provider === "google-ai-studio" && this.config.apiKey) {
      this.googleClient = createGoogleClient(this.config.apiKey);
    }
  }

  /** Abort all in-flight requests immediately. */
  abort(): void {
    this.abortController.abort();
    // Reject all queued waiters
    for (const waiter of this.waitQueue) {
      waiter.reject(new AiClientError("Client has been aborted"));
    }
    this.waitQueue = [];
  }

  /** Get the current abort signal for passing to providers. */
  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (this.abortController.signal.aborted) {
      throw new AiClientError("Client has been aborted");
    }

    // Acquire a concurrency slot (blocks if all slots are busy)
    await this.acquireSlot();

    try {
      return await this.generateWithRetry(options);
    } finally {
      this.releaseSlot();
    }
  }

  private async generateWithRetry(options: GenerateOptions): Promise<GenerateResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (this.abortController.signal.aborted) {
        throw new AiClientError("Client has been aborted");
      }

      try {
        await this.waitForConfiguredDelay();
        const result = await this.callProvider(options);
        this.callCount++;
        this.totalTokensUsed += result.tokensUsed;
        return result;
      } catch (error) {
        if (this.abortController.signal.aborted) {
          throw new AiClientError("Client has been aborted");
        }

        lastError = error as Error;

        // Permanent rate limits (daily cap) — fail immediately, retrying won't help
        if (error instanceof PermanentRateLimitError) {
          console.error(`[AI Client] Permanent rate limit: ${error.message}`);
          throw error;
        }

        if (this.isRateLimitError(error)) {
          // Aggressive backoff for temporary rate limits: 5s, 10s, 20s, 40s...
          const delay = Math.max(5000, this.config.retryDelayMs) * Math.pow(2, attempt);
          console.log(`[AI Client] Rate limited, backing off ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries})`);
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

  private async waitForConfiguredDelay(): Promise<void> {
    if (this.config.delayBetweenCalls <= 0) {
      return;
    }

    let releaseLock!: () => void;
    const previous = this.scheduleQueue;
    this.scheduleQueue = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    await previous;

    try {
      const now = Date.now();
      const waitMs = Math.max(0, this.nextRequestNotBefore - now);

      if (waitMs > 0) {
        await this.sleep(waitMs);
      }

      this.nextRequestNotBefore = Math.max(now, this.nextRequestNotBefore) + this.config.delayBetweenCalls;
    } finally {
      releaseLock();
    }
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

  /** Acquire a concurrency slot; blocks until one is available. */
  private async acquireSlot(): Promise<void> {
    if (this.abortController.signal.aborted) {
      throw new AiClientError("Client has been aborted");
    }

    if (this.activeRequests < this.maxConcurrency) {
      this.activeRequests++;
      return;
    }

    // All slots busy — wait in queue
    await new Promise<void>((resolve, reject) => {
      if (this.abortController.signal.aborted) {
        reject(new AiClientError("Client has been aborted"));
        return;
      }

      const entry = { resolve, reject };
      this.waitQueue.push(entry);

      // If client is aborted while waiting, reject
      const onAbort = () => {
        const idx = this.waitQueue.indexOf(entry);
        if (idx !== -1) this.waitQueue.splice(idx, 1);
        reject(new AiClientError("Client has been aborted"));
      };
      this.abortController.signal.addEventListener("abort", onAbort, { once: true });
    });

    this.activeRequests++;
  }

  /** Release a concurrency slot and wake up next waiter. */
  private releaseSlot(): void {
    this.activeRequests--;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next.resolve();
    }
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.message.includes("429") || error.message.includes("rate-limited");
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const signal = this.abortController.signal;
      if (signal.aborted) {
        reject(new AiClientError("Client has been aborted"));
        return;
      }
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new AiClientError("Client has been aborted"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  getCallCount(): number {
    return this.callCount;
  }

  getTotalTokensUsed(): number {
    return this.totalTokensUsed;
  }

  getProvider(): string {
    return this.config.provider;
  }
}
