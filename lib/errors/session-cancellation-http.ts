import {
  SessionCancellationConflictError,
  SessionCancellationCutoffError,
  SessionCancellationForbiddenError,
  SessionCancellationInvariantError,
  SessionCancellationStateError,
  SessionCancellationTargetNotFoundError,
} from "@/lib/errors/session-cancellation-errors";

export function sessionPrivateJson(
  body: unknown,
  init: ResponseInit = {},
): Response {
  const headers =
    new Headers(init.headers);

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

export function sessionCancellationErrorResponse(
  error: unknown,
): Response | null {
  if (
    error instanceof
    SessionCancellationTargetNotFoundError
  ) {
    return sessionPrivateJson(
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
    SessionCancellationForbiddenError
  ) {
    return sessionPrivateJson(
      {
        error:
          "SESSION_CANCELLATION_FORBIDDEN",
      },
      {
        status: 403,
      },
    );
  }

  if (
    error instanceof
    SessionCancellationCutoffError
  ) {
    return sessionPrivateJson(
      {
        error:
          "CANCELLATION_CUTOFF",
      },
      {
        status: 409,
      },
    );
  }

  if (
    error instanceof
    SessionCancellationStateError
  ) {
    return sessionPrivateJson(
      {
        error:
          "SESSION_STATE_CONFLICT",

        state:
          error.state,
      },
      {
        status: 409,
      },
    );
  }

  if (
    error instanceof
    SessionCancellationConflictError
  ) {
    return sessionPrivateJson(
      {
        error:
          "SESSION_CANCELLATION_CONFLICT",
      },
      {
        status: 409,
      },
    );
  }

  if (
    error instanceof
    SessionCancellationInvariantError
  ) {
    console.error(
      "Speaking-session cancellation invariant violation:",
      error,
    );

    return sessionPrivateJson(
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
