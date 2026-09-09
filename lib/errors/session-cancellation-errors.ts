export class SessionCancellationTargetNotFoundError
  extends Error {
  constructor() {
    super(
      "The speaking session was not found or cannot be accessed by this actor.",
    );

    this.name =
      "SessionCancellationTargetNotFoundError";
  }
}

export class SessionCancellationForbiddenError
  extends Error {
  constructor() {
    super(
      "The authenticated user is not eligible to cancel this speaking session.",
    );

    this.name =
      "SessionCancellationForbiddenError";
  }
}

export class SessionCancellationCutoffError
  extends Error {
  constructor() {
    super(
      "The speaking session is inside the student cancellation cutoff.",
    );

    this.name =
      "SessionCancellationCutoffError";
  }
}

export class SessionCancellationStateError
  extends Error {
  constructor(
    public readonly state:
      | "COMPLETED"
      | "STARTED"
      | "NOT_CANCELLABLE",
  ) {
    super(
      `The speaking session cannot be cancelled from state: ${state}.`,
    );

    this.name =
      "SessionCancellationStateError";
  }
}

export class SessionCancellationConflictError
  extends Error {
  constructor() {
    super(
      "The speaking session cancellation changed concurrently. The request should be retried.",
    );

    this.name =
      "SessionCancellationConflictError";
  }
}

export class SessionCancellationInvariantError
  extends Error {
  constructor() {
    super(
      "Speaking session cancellation history is inconsistent with the session state.",
    );

    this.name =
      "SessionCancellationInvariantError";
  }
}
