import { AdminForbiddenError, AdminReviewConflictError, AdminReviewProviderError, AdminTargetNotFoundError } from "@/lib/errors/admin-errors";

export function adminPrivateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return Response.json(body, { ...init, headers });
}

export function adminErrorResponse(error: unknown): Response {
  if (error instanceof AdminForbiddenError) return adminPrivateJson({ error: "ADMIN_FORBIDDEN" }, { status: 403 });
  if (error instanceof AdminTargetNotFoundError) return adminPrivateJson({ error: "APPLICATION_NOT_FOUND" }, { status: 404 });
  if (error instanceof AdminReviewConflictError) return adminPrivateJson({ error: "REVIEW_STATE_CONFLICT" }, { status: 409 });
  if (error instanceof AdminReviewProviderError) return adminPrivateJson({ error: "REVIEW_PLAYBACK_UNAVAILABLE" }, { status: 502 });
  console.error("Unexpected admin review error:", error);
  return adminPrivateJson({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
}
