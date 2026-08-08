export class AdminForbiddenError extends Error {
  constructor() { super("Administrative access is required."); this.name = "AdminForbiddenError"; }
}

export class AdminTargetNotFoundError extends Error {
  constructor() { super("The review target was not found."); this.name = "AdminTargetNotFoundError"; }
}

export class AdminReviewConflictError extends Error {
  constructor() { super("The application changed or is no longer reviewable."); this.name = "AdminReviewConflictError"; }
}

export class AdminReviewProviderError extends Error {
  constructor() { super("Review playback is temporarily unavailable."); this.name = "AdminReviewProviderError"; }
}
