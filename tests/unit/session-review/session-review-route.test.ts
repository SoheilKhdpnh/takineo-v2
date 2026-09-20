import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  getApiSession: vi.fn(),
  getUserAccessContext: vi.fn(),
  hasTrustedRequestOrigin: vi.fn(),
  getSessionReviewForStudent: vi.fn(),
  submitSessionReview: vi.fn(),
}));

vi.mock("@/lib/auth/api-session", () => ({
  getApiSession: mocks.getApiSession,
}));

vi.mock("@/lib/auth/access", () => ({
  getUserAccessContext: mocks.getUserAccessContext,
}));

vi.mock("@/lib/security/same-origin", () => ({
  hasTrustedRequestOrigin: mocks.hasTrustedRequestOrigin,
}));

vi.mock("@/lib/services/session-review.service", () => ({
  getSessionReviewForStudent: mocks.getSessionReviewForStudent,
  submitSessionReview: mocks.submitSessionReview,
}));

import {
  GET as getReview,
  POST as submitReview,
} from "@/app/api/sessions/[sessionId]/review/route";
import {
  SessionReviewDeniedError,
} from "@/lib/errors/session-review-errors";

const SESSION_ID = "session-1";

function request(
  method: "GET" | "POST",
  body?: unknown,
) {
  return new Request(
    `http://localhost:3000/api/sessions/${SESSION_ID}/review`,
    {
      method,
      headers: {
        "content-type": "application/json",
        origin: "https://takineo.example",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
}

function access() {
  return {
    id: "student-1",
    role: "STUDENT",
    accountStatus: "ACTIVE",
    onboardingCompletedAt: new Date(),
    studentProfile: { id: "student-profile", profileCompletedAt: new Date() },
    teacherProfile: null,
  };
}

describe("session-review route", () => {
  beforeEach(() => {
    mocks.hasTrustedRequestOrigin.mockReturnValue(true);
    mocks.getApiSession.mockResolvedValue({
      user: { id: "student-1" },
    });
    mocks.getUserAccessContext.mockResolvedValue(access());
    mocks.getSessionReviewForStudent.mockResolvedValue(null);
    mocks.submitSessionReview.mockResolvedValue({
      id: "review-1",
      sessionId: SESSION_ID,
      studentUserId: "student-1",
      teacherUserId: "teacher-1",
      rating: 5,
      comment: null,
      createdAt: new Date("2026-09-20T10:16:00.000Z"),
    });
  });

  it("rejects an untrusted origin before writing a review", async () => {
    mocks.hasTrustedRequestOrigin.mockReturnValue(false);

    const response = await submitReview(
      request("POST", { rating: 5 }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "UNTRUSTED_ORIGIN",
    });
    expect(mocks.submitSessionReview).not.toHaveBeenCalled();
  });

  it("rejects a teacher who is not the student", async () => {
    mocks.submitSessionReview.mockRejectedValue(
      new SessionReviewDeniedError("NOT_STUDENT"),
    );

    const response = await submitReview(
      request("POST", { rating: 4 }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "REVIEW_NOT_STUDENT",
    });
  });

  it("stores a valid student rating", async () => {
    const response = await submitReview(
      request("POST", { rating: 5, comment: "Clear." }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      review: {
        id: "review-1",
        sessionId: SESSION_ID,
        studentUserId: "student-1",
        teacherUserId: "teacher-1",
        rating: 5,
        comment: null,
        createdAt: "2026-09-20T10:16:00.000Z",
      },
    });
  });

  it("returns a null review for a student who has not rated yet", async () => {
    const response = await getReview(request("GET"), {
      params: Promise.resolve({ sessionId: SESSION_ID }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      review: null,
    });
  });
});
