import "server-only";

import {
  SessionReviewAlreadySubmittedError,
  SessionReviewDeniedError,
  SessionReviewTargetNotFoundError,
} from "@/lib/errors/session-review-errors";

export function sessionReviewPrivateJson(
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

function safeUnexpectedSessionReviewError(
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

export function sessionReviewErrorResponse(
  error: unknown,
): Response {
  if (error instanceof SessionReviewTargetNotFoundError) {
    return sessionReviewPrivateJson(
      { error: "SESSION_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (error instanceof SessionReviewDeniedError) {
    if (error.reason === "NOT_STUDENT") {
      return sessionReviewPrivateJson(
        { error: "REVIEW_NOT_STUDENT" },
        { status: 403 },
      );
    }

    return sessionReviewPrivateJson(
      { error: "SESSION_NOT_REVIEWABLE" },
      { status: 409 },
    );
  }

  if (error instanceof SessionReviewAlreadySubmittedError) {
    return sessionReviewPrivateJson(
      { error: "SESSION_REVIEW_ALREADY_SUBMITTED" },
      { status: 409 },
    );
  }

  console.error(
    "Unexpected session-review failure:",
    safeUnexpectedSessionReviewError(error),
  );

  return sessionReviewPrivateJson(
    { error: "INTERNAL_SERVER_ERROR" },
    { status: 500 },
  );
}
