import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  speakingSession: {
    findUnique: vi.fn(),
  },
  sessionReview: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    speakingSession: mocks.speakingSession,
    sessionReview: mocks.sessionReview,
  },
}));

import {
  SessionReviewAlreadySubmittedError,
  SessionReviewDeniedError,
  SessionReviewTargetNotFoundError,
} from "@/lib/errors/session-review-errors";
import {
  getSessionReviewForStudent,
  submitSessionReview,
} from "@/lib/services/session-review.service";
import {
  makeUniqueConstraintError,
} from "@/tests/unit/live-session/prisma-error";

const START_AT = new Date("2026-09-20T10:00:00.000Z");
const AS_OF = new Date("2026-09-20T10:16:00.000Z");

function scheduledSession() {
  return {
    id: "session-1",
    status: "SCHEDULED",
    startAt: START_AT,
    studentUserId: "student-1",
    teacherProfile: {
      userId: "teacher-1",
    },
  };
}

describe("session-review service", () => {
  beforeEach(() => {
    mocks.speakingSession.findUnique.mockReset();
    mocks.sessionReview.findUnique.mockReset();
    mocks.sessionReview.create.mockReset();
  });

  it("stores a student rating against the session teacher", async () => {
    mocks.speakingSession.findUnique.mockResolvedValue(scheduledSession());
    mocks.sessionReview.create.mockResolvedValue({
      id: "review-1",
      sessionId: "session-1",
      studentUserId: "student-1",
      teacherUserId: "teacher-1",
      rating: 5,
      comment: "Warm and clear.",
      createdAt: AS_OF,
    });

    await expect(
      submitSessionReview(
        "student-1",
        {
          sessionId: "session-1",
          rating: 5,
          comment: "  Warm and clear.  ",
        },
        { asOf: AS_OF },
      ),
    ).resolves.toMatchObject({
      sessionId: "session-1",
      teacherUserId: "teacher-1",
      rating: 5,
      comment: "Warm and clear.",
    });

    expect(mocks.sessionReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentUserId: "student-1",
          teacherUserId: "teacher-1",
          rating: 5,
          comment: "Warm and clear.",
        }),
      }),
    );
  });

  it("does not let the teacher rate the session", async () => {
    mocks.speakingSession.findUnique.mockResolvedValue(scheduledSession());

    await expect(
      submitSessionReview(
        "teacher-1",
        {
          sessionId: "session-1",
          rating: 5,
        },
        { asOf: AS_OF },
      ),
    ).rejects.toBeInstanceOf(SessionReviewDeniedError);

    expect(mocks.sessionReview.create).not.toHaveBeenCalled();
  });

  it("hides missing sessions from the student lookup", async () => {
    mocks.speakingSession.findUnique.mockResolvedValue(null);

    await expect(
      getSessionReviewForStudent("student-1", "session-1"),
    ).rejects.toBeInstanceOf(SessionReviewTargetNotFoundError);
  });

  it("rejects a second review for the same session", async () => {
    mocks.speakingSession.findUnique.mockResolvedValue(scheduledSession());
    mocks.sessionReview.create.mockRejectedValue(
      makeUniqueConstraintError(
        "session_review_sessionId_key",
        "SessionReview",
        ["sessionId"],
      ),
    );

    await expect(
      submitSessionReview(
        "student-1",
        {
          sessionId: "session-1",
          rating: 4,
        },
        { asOf: AS_OF },
      ),
    ).rejects.toBeInstanceOf(SessionReviewAlreadySubmittedError);
  });
});
