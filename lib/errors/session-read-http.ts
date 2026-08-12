import "server-only";

import {
  SessionReadCursorError,
  SessionReadForbiddenError,
  SessionReadInvariantError,
  SessionReadTargetNotFoundError,
} from "@/lib/errors/session-read-errors";
import type {
  SpeakingSessionListResult,
  SpeakingSessionView,
} from "@/lib/services/speaking-session-read.service";

export function sessionReadPrivateJson(
  body:
    unknown,
  init:
    ResponseInit = {},
): Response {
  const headers =
    new Headers(
      init.headers,
    );

  headers.set(
    "Cache-Control",
    "private, no-store",
  );

  return Response.json(
    body,
    {
      ...init,

      headers,
    },
  );
}

export function serializeSpeakingSessionView(
  session:
    SpeakingSessionView,
) {
  return {
    id:
      session.id,

    startAt:
      session.startAt
        .toISOString(),

    endAt:
      session.endAt
        .toISOString(),

    status:
      session.status,

    counterparty:
      session.counterparty,

    cancellation:
      session.cancellation
        ? {
            actorType:
              session
                .cancellation
                .actorType,

            cancelledAt:
              session
                .cancellation
                .cancelledAt
                .toISOString(),
          }
        : null,
  };
}

export function serializeSpeakingSessionList(
  result:
    SpeakingSessionListResult,
) {
  return {
    items:
      result.items.map(
        serializeSpeakingSessionView,
      ),

    hasMore:
      result.hasMore,

    nextCursor:
      result.nextCursor,
  };
}

export function sessionReadErrorResponse(
  error:
    unknown,
): Response | null {
  if (
    error instanceof
      SessionReadCursorError
  ) {
    return sessionReadPrivateJson(
      {
        error:
          "INVALID_REQUEST",
      },
      {
        status: 400,
      },
    );
  }

  if (
    error instanceof
      SessionReadForbiddenError
  ) {
    return sessionReadPrivateJson(
      {
        error:
          "SESSION_READ_FORBIDDEN",
      },
      {
        status: 403,
      },
    );
  }

  if (
    error instanceof
      SessionReadTargetNotFoundError
  ) {
    return sessionReadPrivateJson(
      {
        error:
          "SESSION_NOT_FOUND",
      },
      {
        status: 404,
      },
    );
  }

  if (
    error instanceof
      SessionReadInvariantError
  ) {
    console.error(
      "Speaking-session read invariant failure:",
      error,
    );

    return sessionReadPrivateJson(
      {
        error:
          "INTERNAL_SERVER_ERROR",
      },
      {
        status: 500,
      },
    );
  }

  return null;
}
