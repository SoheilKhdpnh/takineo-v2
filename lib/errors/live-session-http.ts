import "server-only";

import type {
  LiveSessionJoinDenialReason,
} from "@/lib/domain/live-session/policy";
import {
  LiveSessionAccountInactiveError,
  LiveSessionConfigurationError,
  LiveSessionConflictError,
  LiveSessionEventShapeConflictError,
  LiveSessionInvalidWebhookSignatureError,
  LiveSessionJoinAttemptConflictError,
  LiveSessionJoinDeniedError,
  LiveSessionMalformedEventError,
  LiveSessionNotParticipantError,
  LiveSessionTargetNotFoundError,
  LiveSessionUnknownSessionError,
} from "@/lib/errors/live-session-errors";

const JOIN_DENIED_ERROR_CODE: Record<
  LiveSessionJoinDenialReason,
  string
> = {
  NOT_PARTICIPANT: "JOIN_NOT_PARTICIPANT",
  ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
  SESSION_NOT_JOINABLE: "SESSION_NOT_JOINABLE",
  JOIN_WINDOW_NOT_OPEN: "JOIN_WINDOW_NOT_OPEN",
  JOIN_WINDOW_CLOSED: "JOIN_WINDOW_CLOSED",
};

const JOIN_DENIED_STATUS: Record<
  LiveSessionJoinDenialReason,
  number
> = {
  NOT_PARTICIPANT: 403,
  ACCOUNT_INACTIVE: 403,
  SESSION_NOT_JOINABLE: 409,
  JOIN_WINDOW_NOT_OPEN: 403,
  JOIN_WINDOW_CLOSED: 403,
};

export function liveSessionPrivateJson(
  body: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");

  return Response.json(body, {
    ...init,
    headers,
  });
}

function safeUnexpectedLiveSessionError(
  error: unknown,
): {
  name: string;
} {
  const candidate = error instanceof Error ? error.name : null;

  return {
    name:
      typeof candidate === "string" &&
      /^[A-Za-z0-9_-]{1,64}$/.test(candidate)
        ? candidate
        : "UnknownError",
  };
}

export function liveSessionMutationErrorResponse(
  error: unknown,
): Response {
  if (error instanceof LiveSessionConfigurationError) {
    return liveSessionPrivateJson(
      { error: "LIVE_SESSION_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  if (error instanceof LiveSessionTargetNotFoundError) {
    return liveSessionPrivateJson(
      { error: "SESSION_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (error instanceof LiveSessionNotParticipantError) {
    return liveSessionPrivateJson(
      { error: "JOIN_NOT_PARTICIPANT" },
      { status: 403 },
    );
  }

  if (error instanceof LiveSessionAccountInactiveError) {
    return liveSessionPrivateJson(
      { error: "ACCOUNT_INACTIVE" },
      { status: 403 },
    );
  }

  if (error instanceof LiveSessionJoinDeniedError) {
    return liveSessionPrivateJson(
      { error: JOIN_DENIED_ERROR_CODE[error.reason] },
      { status: JOIN_DENIED_STATUS[error.reason] },
    );
  }

  if (error instanceof LiveSessionJoinAttemptConflictError) {
    return liveSessionPrivateJson(
      { error: "JOIN_ATTEMPT_CONFLICT" },
      { status: 409 },
    );
  }

  if (error instanceof LiveSessionConflictError) {
    return liveSessionPrivateJson(
      { error: "LIVE_SESSION_CONFLICT" },
      { status: 409 },
    );
  }

  console.error(
    "Unexpected live-session mutation failure:",
    safeUnexpectedLiveSessionError(error),
  );

  return liveSessionPrivateJson(
    { error: "INTERNAL_SERVER_ERROR" },
    { status: 500 },
  );
}

export function liveSessionWebhookErrorResponse(
  error: unknown,
): Response {
  if (error instanceof LiveSessionConfigurationError) {
    return Response.json(
      { error: "WEBHOOK_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  if (error instanceof LiveSessionInvalidWebhookSignatureError) {
    return Response.json(
      { error: "INVALID_WEBHOOK_SIGNATURE" },
      { status: 400 },
    );
  }

  if (error instanceof LiveSessionMalformedEventError) {
    return Response.json(
      { error: "INVALID_WEBHOOK_BODY" },
      { status: 400 },
    );
  }

  if (error instanceof LiveSessionUnknownSessionError) {
    return Response.json(
      { error: "UNKNOWN_LIVE_SESSION" },
      { status: 400 },
    );
  }

  if (error instanceof LiveSessionEventShapeConflictError) {
    return Response.json(
      { error: "INVALID_EVENT_SHAPE" },
      { status: 400 },
    );
  }

  if (error instanceof LiveSessionConflictError) {
    return Response.json(
      { error: "LIVE_SESSION_CONFLICT" },
      { status: 409 },
    );
  }

  console.error(
    "Live-session webhook processing failed:",
    safeUnexpectedLiveSessionError(error),
  );

  return Response.json(
    { error: "WEBHOOK_PROCESSING_FAILED" },
    { status: 500 },
  );
}

export function liveSessionReadErrorResponse(
  error: unknown,
): Response | null {
  if (error instanceof LiveSessionConfigurationError) {
    return liveSessionPrivateJson(
      { error: "LIVE_SESSION_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  if (error instanceof LiveSessionTargetNotFoundError) {
    return liveSessionPrivateJson(
      { error: "SESSION_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (error instanceof LiveSessionNotParticipantError) {
    return liveSessionPrivateJson(
      { error: "JOIN_NOT_PARTICIPANT" },
      { status: 403 },
    );
  }

  if (error instanceof LiveSessionAccountInactiveError) {
    return liveSessionPrivateJson(
      { error: "ACCOUNT_INACTIVE" },
      { status: 403 },
    );
  }

  return null;
}
