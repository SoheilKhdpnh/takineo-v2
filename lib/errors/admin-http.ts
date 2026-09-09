import { AdminForbiddenError, AdminReviewConflictError, AdminReviewProviderError, AdminTargetNotFoundError } from "@/lib/errors/admin-errors";

export function adminPrivateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return Response.json(body, { ...init, headers });
}

function safeUnexpectedAdminError(error: unknown) {
  const candidateName = error instanceof Error ? error.name : null;
  const errorName =
    typeof candidateName === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(candidateName)
      ? candidateName
      : "UnknownError";
  const candidateCode =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : null;
  const errorCode =
    typeof candidateCode === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(candidateCode)
      ? candidateCode
      : null;

  return { errorName, errorCode };
}

export function adminErrorResponse(error: unknown): Response {
  if (error instanceof AdminForbiddenError) return adminPrivateJson({ error: "ADMIN_FORBIDDEN" }, { status: 403 });
  if (error instanceof AdminTargetNotFoundError) return adminPrivateJson({ error: "APPLICATION_NOT_FOUND" }, { status: 404 });
  if (error instanceof AdminReviewConflictError) return adminPrivateJson({ error: "REVIEW_STATE_CONFLICT" }, { status: 409 });
  if (error instanceof AdminReviewProviderError) return adminPrivateJson({ error: "REVIEW_PLAYBACK_UNAVAILABLE" }, { status: 502 });
  console.error("Unexpected admin review error:", safeUnexpectedAdminError(error));
  return adminPrivateJson({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
}
