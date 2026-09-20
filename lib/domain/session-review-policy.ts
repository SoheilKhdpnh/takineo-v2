export const SESSION_REVIEW_MIN_RATING = 1;
export const SESSION_REVIEW_MAX_RATING = 5;
export const SESSION_REVIEW_MAX_COMMENT_LENGTH = 500;

export type SessionReviewDenialReason =
  | "NOT_STUDENT"
  | "SESSION_NOT_REVIEWABLE";

export type SessionReviewEligibility =
  | { ok: true }
  | { ok: false; reason: SessionReviewDenialReason };

export function decideSessionReviewEligibility(input: {
  actorUserId: string;
  studentUserId: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  startAt: Date;
  asOf: Date;
}): SessionReviewEligibility {
  if (input.actorUserId !== input.studentUserId) {
    return {
      ok: false,
      reason: "NOT_STUDENT",
    };
  }

  if (input.status === "CANCELLED") {
    return {
      ok: false,
      reason: "SESSION_NOT_REVIEWABLE",
    };
  }

  if (input.asOf.getTime() < input.startAt.getTime()) {
    return {
      ok: false,
      reason: "SESSION_NOT_REVIEWABLE",
    };
  }

  return { ok: true };
}

export function normalizeSessionReviewComment(
  comment: string | null | undefined,
): string | null {
  if (typeof comment !== "string") {
    return null;
  }

  const trimmed = comment.trim();
  return trimmed.length === 0 ? null : trimmed;
}
