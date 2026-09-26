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
  readLiveSessionEvidence: vi.fn(),
}));

vi.mock("@/lib/auth/api-session", () => ({
  getApiSession: mocks.getApiSession,
}));

vi.mock("@/lib/auth/access", () => ({
  getUserAccessContext: mocks.getUserAccessContext,
}));

vi.mock("@/lib/services/live-session-evidence.service", () => ({
  readLiveSessionEvidence: mocks.readLiveSessionEvidence,
}));

import {
  GET as readEvidence,
} from "@/app/api/sessions/[sessionId]/live-evidence/route";
import {
  LiveSessionNotParticipantError,
} from "@/lib/errors/live-session-errors";

function access() {
  return {
    id: "student-user",
    role: "STUDENT",
    accountStatus: "ACTIVE",
    onboardingCompletedAt: new Date(),
    studentProfile: { id: "student-profile", profileCompletedAt: new Date() },
    teacherProfile: null,
  };
}

describe("live-session evidence route", () => {
  beforeEach(() => {
    mocks.getApiSession.mockResolvedValue({
      user: { id: "student-user" },
    });
    mocks.getUserAccessContext.mockResolvedValue(access());
    mocks.readLiveSessionEvidence.mockResolvedValue({
      sessionId: "session-1",
      asOf: new Date("2026-08-20T10:20:00.000Z"),
      analyticalHorizonAt: new Date("2026-08-20T10:20:00.000Z"),
      liveEvidenceHorizonAt: new Date("2026-08-20T10:20:00.000Z"),
      roomEndedAt: null,
      conflictingProviderEventRefCount: 0,
      unattributedParticipantEventCount: 0,
      participants: [],
    });
  });

  it("requires an authenticated active participant", async () => {
    mocks.getApiSession.mockResolvedValue(null);

    const response = await readEvidence(
      new Request("http://localhost:3000/api/sessions/session-1/live-evidence"),
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("maps a non-participant to a stable denial", async () => {
    mocks.readLiveSessionEvidence.mockRejectedValue(
      new LiveSessionNotParticipantError(),
    );

    const response = await readEvidence(
      new Request("http://localhost:3000/api/sessions/session-1/live-evidence"),
      { params: Promise.resolve({ sessionId: "session-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "JOIN_NOT_PARTICIPANT",
    });
  });
});
