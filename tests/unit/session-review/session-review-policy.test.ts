import {
  describe,
  expect,
  it,
} from "vitest";

import {
  decideSessionReviewEligibility,
  normalizeSessionReviewComment,
} from "@/lib/domain/session-review-policy";

const START_AT = new Date("2026-09-20T10:00:00.000Z");

describe("session review eligibility", () => {
  it("allows the student after the session has started", () => {
    expect(
      decideSessionReviewEligibility({
        actorUserId: "student-1",
        studentUserId: "student-1",
        status: "SCHEDULED",
        startAt: START_AT,
        asOf: new Date("2026-09-20T10:01:00.000Z"),
      }),
    ).toEqual({ ok: true });
  });

  it("denies a teacher or any other actor without describing session state", () => {
    expect(
      decideSessionReviewEligibility({
        actorUserId: "teacher-1",
        studentUserId: "student-1",
        status: "SCHEDULED",
        startAt: START_AT,
        asOf: new Date("2026-09-20T10:01:00.000Z"),
      }),
    ).toEqual({
      ok: false,
      reason: "NOT_STUDENT",
    });
  });

  it("does not accept a cancelled session or a review before start", () => {
    expect(
      decideSessionReviewEligibility({
        actorUserId: "student-1",
        studentUserId: "student-1",
        status: "CANCELLED",
        startAt: START_AT,
        asOf: new Date("2026-09-20T10:16:00.000Z"),
      }),
    ).toEqual({
      ok: false,
      reason: "SESSION_NOT_REVIEWABLE",
    });

    expect(
      decideSessionReviewEligibility({
        actorUserId: "student-1",
        studentUserId: "student-1",
        status: "SCHEDULED",
        startAt: START_AT,
        asOf: new Date("2026-09-20T09:59:00.000Z"),
      }),
    ).toEqual({
      ok: false,
      reason: "SESSION_NOT_REVIEWABLE",
    });
  });

  it("treats blank comments as omitted", () => {
    expect(normalizeSessionReviewComment("  ")).toBeNull();
    expect(normalizeSessionReviewComment("Clear and patient.")).toBe(
      "Clear and patient.",
    );
  });
});
