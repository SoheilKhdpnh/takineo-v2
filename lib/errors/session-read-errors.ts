export class SessionReadForbiddenError
  extends Error {
  constructor() {
    super(
      "The authenticated account cannot access the speaking-session read surface.",
    );

    this.name =
      "SessionReadForbiddenError";
  }
}

export class SessionReadTargetNotFoundError
  extends Error {
  constructor() {
    super(
      "The speaking session was not found or is not accessible by this viewer.",
    );

    this.name =
      "SessionReadTargetNotFoundError";
  }
}

export class SessionReadInvariantError
  extends Error {
  constructor(
    message =
      "The speaking-session read model encountered an impossible account or session state.",
  ) {
    super(message);

    this.name =
      "SessionReadInvariantError";
  }
}

export class SessionReadCursorError
  extends Error {
  constructor() {
    super(
      "The speaking-session pagination cursor is invalid.",
    );

    this.name =
      "SessionReadCursorError";
  }
}
