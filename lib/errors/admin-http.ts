import { AdminForbiddenError, AdminReviewConflictError, AdminReviewProviderError, AdminTargetNotFoundError } from "@/lib/errors/admin-errors";

export function adminErrorResponse(error: unknown): Response {
  if (error instanceof AdminForbiddenError) return Response.json({ error: "ADMIN_FORBIDDEN" }, { status: 403 });
  if (error instanceof AdminTargetNotFoundError) return Response.json({ error: "APPLICATION_NOT_FOUND" }, { status: 404 });
  if (error instanceof AdminReviewConflictError) return Response.json({ error: "REVIEW_STATE_CONFLICT" }, { status: 409 });
  if (error instanceof AdminReviewProviderError) return Response.json({ error: "REVIEW_PLAYBACK_UNAVAILABLE" }, { status: 502 });
  console.error("Unexpected admin review error:", error);
  return Response.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
}
