import type {
  SessionReviewDenialReason,
} from "@/lib/domain/session-review-policy";

export class SessionReviewTargetNotFoundError extends Error {
  constructor() {
    super(
      "The speaking session was not found or is not accessible.",
    );
    this.name = "SessionReviewTargetNotFoundError";
  }
}

export class SessionReviewDeniedError extends Error {
  constructor(
    public readonly reason: SessionReviewDenialReason,
  ) {
    super(`Session review was denied: ${reason}.`);
    this.name = "SessionReviewDeniedError";
  }
}

export class SessionReviewAlreadySubmittedError extends Error {
  constructor() {
    super("A review for this speaking session already exists.");
    this.name = "SessionReviewAlreadySubmittedError";
  }
}
