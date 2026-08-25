import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  LiveSessionJoinDenialReason,
} from "@/lib/domain/live-session/policy";

const mocks = vi.hoisted(() => ({
  getApiSession: vi.fn(),
  getUserAccessContext: vi.fn(),
  hasTrustedRequestOrigin: vi.fn(),
  issueLiveSessionJoinGrant: vi.fn(),
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

vi.mock("@/lib/services/live-session-grant.service", () => ({
  issueLiveSessionJoinGrant: mocks.issueLiveSessionJoinGrant,
}));

import {
  POST as joinSession,
} from "@/app/api/sessions/[sessionId]/join/route";
import {
  LiveSessionJoinDeniedError,
} from "@/lib/errors/live-session-errors";

const SESSION_ID = "session-1";

function request(body: unknown = { clientJoinAttemptId: "attempt-1" }) {
  return new Request("http://localhost:3000/api/sessions/session-1/join", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://takineo.example",
    },
    body: JSON.stringify(body),
  });
}

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

describe("live-session join route", () => {
  beforeEach(() => {
    mocks.hasTrustedRequestOrigin.mockReturnValue(true);
    mocks.getApiSession.mockResolvedValue({
      user: { id: "student-user" },
    });
    mocks.getUserAccessContext.mockResolvedValue(access());
    mocks.issueLiveSessionJoinGrant.mockResolvedValue({
      grant: {
        grantId: "grant-1",
        sessionId: SESSION_ID,
        clientJoinAttemptId: "attempt-1",
        participantUserId: "student-user",
        participantRole: "STUDENT",
        providerParticipantRef: "fake-ppr:1",
        authorizedAt: new Date("2026-08-20T10:00:00.000Z"),
      },
      credential: "fake-live:grant-1:token",
      expiresAt: new Date("2026-08-20T10:15:00.000Z"),
      replayed: false,
    });
  });

  it("rejects an untrusted origin before joining", async () => {
    mocks.hasTrustedRequestOrigin.mockReturnValue(false);

    const response = await joinSession(request(), {
      params: Promise.resolve({ sessionId: SESSION_ID }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "UNTRUSTED_ORIGIN",
    });
    expect(mocks.issueLiveSessionJoinGrant).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    mocks.getApiSession.mockResolvedValue(null);

    const response = await joinSession(request(), {
      params: Promise.resolve({ sessionId: SESSION_ID }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "UNAUTHORIZED",
    });
  });

  it("issues a credential to an authorized participant", async () => {
    const response = await joinSession(request(), {
      params: Promise.resolve({ sessionId: SESSION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.credential).toBe("fake-live:grant-1:token");
    expect(body.grant.grantId).toBe("grant-1");
    expect(body.grant).not.toHaveProperty("providerParticipantRef");
  });

  it.each([
    ["NOT_PARTICIPANT", "JOIN_NOT_PARTICIPANT", 403],
    ["ACCOUNT_INACTIVE", "ACCOUNT_INACTIVE", 403],
    ["SESSION_NOT_JOINABLE", "SESSION_NOT_JOINABLE", 409],
    ["JOIN_WINDOW_NOT_OPEN", "JOIN_WINDOW_NOT_OPEN", 403],
    ["JOIN_WINDOW_CLOSED", "JOIN_WINDOW_CLOSED", 403],
  ] as const)(
    "maps %s to a stable join denial code",
    async (
      reason: LiveSessionJoinDenialReason,
      code: string,
      status: number,
    ) => {
      mocks.issueLiveSessionJoinGrant.mockRejectedValue(
        new LiveSessionJoinDeniedError(reason),
      );

      const response = await joinSession(request(), {
        params: Promise.resolve({ sessionId: SESSION_ID }),
      });

      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({ error: code });
    },
  );
});
