export class SessionAnalysisNotEligibleError extends Error {
  constructor(public readonly reason: string) {
    super(`Session analysis is not eligible: ${reason}.`);
    this.name = "SessionAnalysisNotEligibleError";
  }
}

export class SessionAnalysisIdempotencyConflictError extends Error {
  constructor() {
    super(
      "The analysis idempotency key was already used with a different artifact pair.",
    );
    this.name = "SessionAnalysisIdempotencyConflictError";
  }
}

export class SessionAnalysisForbiddenError extends Error {
  constructor() {
    super("The authenticated account cannot write teacher feedback for this session.");
    this.name = "SessionAnalysisForbiddenError";
  }
}

export class SessionAnalysisNotFoundError extends Error {
  constructor() {
    super("The speaking session or analysis target was not found.");
    this.name = "SessionAnalysisNotFoundError";
  }
}
