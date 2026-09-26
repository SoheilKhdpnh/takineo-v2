import type {
  LiveSessionJoinDenialReason,
} from "@/lib/domain/live-session/policy";

export class LiveSessionConfigurationError extends Error {
  constructor(
    message = "Live-session configuration is missing or invalid.",
  ) {
    super(message);
    this.name = "LiveSessionConfigurationError";
  }
}

export class LiveSessionTargetNotFoundError extends Error {
  constructor() {
    super(
      "The speaking session was not found or is not accessible.",
    );
    this.name = "LiveSessionTargetNotFoundError";
  }
}

export class LiveSessionJoinDeniedError extends Error {
  constructor(
    public readonly reason: LiveSessionJoinDenialReason,
  ) {
    super(
      `Live-session join was denied: ${reason}.`,
    );
    this.name = "LiveSessionJoinDeniedError";
  }
}

export class LiveSessionNotParticipantError extends Error {
  constructor() {
    super(
      "The authenticated user is not a participant of this speaking session.",
    );
    this.name = "LiveSessionNotParticipantError";
  }
}

export class LiveSessionAccountInactiveError extends Error {
  constructor() {
    super(
      "The authenticated account is not active.",
    );
    this.name = "LiveSessionAccountInactiveError";
  }
}

export class LiveSessionJoinAttemptConflictError extends Error {
  constructor() {
    super(
      "The join attempt id was already used for a different live-session grant.",
    );
    this.name = "LiveSessionJoinAttemptConflictError";
  }
}

export class LiveSessionConflictError extends Error {
  constructor() {
    super(
      "The live-session request changed concurrently. The request should be retried.",
    );
    this.name = "LiveSessionConflictError";
  }
}

export class LiveSessionUnknownSessionError extends Error {
  constructor() {
    super(
      "The provider event does not resolve to a known speaking session.",
    );
    this.name = "LiveSessionUnknownSessionError";
  }
}

export class LiveSessionInvalidWebhookSignatureError extends Error {
  constructor() {
    super(
      "The live-session webhook signature is invalid.",
    );
    this.name = "LiveSessionInvalidWebhookSignatureError";
  }
}

export class LiveSessionMalformedEventError extends Error {
  constructor() {
    super(
      "The live-session provider event is malformed.",
    );
    this.name = "LiveSessionMalformedEventError";
  }
}

export class LiveSessionEventShapeConflictError extends Error {
  constructor() {
    super(
      "The live-session provider event violated the participant-field shape constraint.",
    );
    this.name = "LiveSessionEventShapeConflictError";
  }
}
