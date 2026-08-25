import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    speakingSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    speakingSessionLiveGrant: {
      findMany: vi.fn(),
    },
    speakingSessionLiveEvent: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mocks.prisma,
}));

import {
  LiveSessionNotParticipantError,
} from "@/lib/errors/live-session-errors";
import {
  readLiveSessionEvidence,
} from "@/lib/services/live-session-evidence.service";

const START_AT = new Date("2026-08-20T10:00:00.000Z");
const END_AT = new Date("2026-08-20T10:15:00.000Z");
const POLICY = {
  rejoinGraceMs: 120_000,
  evidenceHorizonGraceMs: 300_000,
} as const;

describe("live-session evidence read", () => {
  beforeEach(() => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "student-user",
      accountStatus: "ACTIVE",
    });
    mocks.prisma.speakingSession.findUnique.mockResolvedValue({
      id: "session-1",
      status: "SCHEDULED",
      startAt: START_AT,
      endAt: END_AT,
      studentUserId: "student-user",
      teacherProfile: { userId: "teacher-user" },
    });
    mocks.prisma.speakingSessionLiveGrant.findMany.mockResolvedValue([]);
    mocks.prisma.speakingSessionLiveEvent.findMany.mockResolvedValue([]);
  });

  it("composes the pure reducer without writing", async () => {
    const reduction = await readLiveSessionEvidence(
      "student-user",
      "session-1",
      {
        asOf: END_AT,
        policy: POLICY,
      },
    );

    expect(reduction.sessionId).toBe("session-1");
    expect(reduction.participants).toEqual([]);
    expect(mocks.prisma.speakingSession.update).not.toHaveBeenCalled();
    expect(mocks.prisma.speakingSession.updateMany).not.toHaveBeenCalled();
  });

  it("denies a non-participant without reducing another user's session", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "stranger-user",
      accountStatus: "ACTIVE",
    });

    await expect(
      readLiveSessionEvidence("stranger-user", "session-1", {
        asOf: END_AT,
        policy: POLICY,
      }),
    ).rejects.toBeInstanceOf(LiveSessionNotParticipantError);

    expect(
      mocks.prisma.speakingSessionLiveGrant.findMany,
    ).not.toHaveBeenCalled();
  });
});
