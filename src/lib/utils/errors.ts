export class AiClientError extends Error {
  constructor(message: string, public cause?: Error | null) {
    super(message);
    this.name = "AiClientError";
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
