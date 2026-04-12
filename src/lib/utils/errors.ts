export class AiClientError extends Error {
  constructor(message: string, public cause?: Error | null) {
    super(message);
    this.name = "AiClientError";
  }
}

/** Permanent rate limit — daily/monthly cap exhausted. Retrying won't help. */
export class PermanentRateLimitError extends AiClientError {
  constructor(message: string, public resetTimestamp?: number) {
    super(message);
    this.name = "PermanentRateLimitError";
  }
}

export class EvolutionError extends Error {
  constructor(message: string, public cause?: Error | null) {
    super(message);
    this.name = "EvolutionError";
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = "ValidationError";
  }
}
