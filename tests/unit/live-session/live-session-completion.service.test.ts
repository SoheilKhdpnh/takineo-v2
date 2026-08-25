import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    speakingSession: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    speakingSessionLiveGrant: {
      findMany: vi.fn(),
    },
    speakingSessionLiveEvent: {
      findMany: vi.fn(),
    },
  };

  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
      speakingSession: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: mocks.prisma,
}));

import {
  completeLiveSpeakingSession,
} from "@/lib/services/live-session-completion.service";

const START_AT = new Date("2026-08-20T10:00:00.000Z");
const END_AT = new Date("2026-08-20T10:15:00.000Z");
const POLICY = {
  rejoinGraceMs: 120_000,
  evidenceHorizonGraceMs: 300_000,
} as const;
const AFTER_HORIZON = new Date("2026-08-20T10:20:00.000Z");

function scheduledSession() {
  return {
    id: "session-1",
    status: "SCHEDULED" as const,
    startAt: START_AT,
    endAt: END_AT,
  };
}

function grant(role: "STUDENT" | "TEACHER") {
  return {
    id: `grant-${role.toLowerCase()}`,
    sessionId: "session-1",
    participantUserId:
      role === "STUDENT" ? "student-user" : "teacher-user",
    participantRole: role,
    clientJoinAttemptId: `attempt-${role.toLowerCase()}`,
    providerParticipantRef: `ppr-${role.toLowerCase()}`,
    authorizedAt: START_AT,
  };
}

function connected(role: "STUDENT" | "TEACHER") {
  const ref = `ppr-${role.toLowerCase()}`;

  return [
    {
      providerEventRef: `evt-${role}-in`,
      sessionId: "session-1",
      type: "PARTICIPANT_CONNECTED",
      occurredAt: START_AT,
      providerParticipantRef: ref,
      connectionRef: `conn-${role}`,
    },
    {
      providerEventRef: `evt-${role}-out`,
      sessionId: "session-1",
      type: "PARTICIPANT_DISCONNECTED",
      occurredAt: END_AT,
      providerParticipantRef: ref,
      connectionRef: `conn-${role}`,
    },
  ];
}

describe("live-session durable completion", () => {
  beforeEach(() => {
    mocks.prisma.$transaction.mockImplementation(
      async (work: (tx: typeof mocks.tx) => Promise<unknown>) =>
        work(mocks.tx),
    );
    mocks.tx.$executeRaw.mockResolvedValue(undefined);
    mocks.tx.speakingSession.findUnique.mockResolvedValue(
      scheduledSession(),
    );
    mocks.tx.speakingSessionLiveGrant.findMany.mockResolvedValue([]);
    mocks.tx.speakingSessionLiveEvent.findMany.mockResolvedValue([]);
    mocks.tx.speakingSession.updateMany.mockResolvedValue({ count: 1 });
  });

  it("does not complete an elapsed scheduled session from time alone", async () => {
    const result = await completeLiveSpeakingSession("session-1", {
      asOf: AFTER_HORIZON,
      policy: POLICY,
    });

    expect(result).toMatchObject({
      completed: false,
      reason: "NO_PARTICIPANT_PRESENCE",
    });
    expect(mocks.tx.speakingSession.updateMany).not.toHaveBeenCalled();
  });

  it("does not treat ROOM_ENDED as sufficient for completion before the horizon", async () => {
    mocks.tx.speakingSessionLiveGrant.findMany.mockResolvedValue([
      grant("STUDENT"),
      grant("TEACHER"),
    ]);
    mocks.tx.speakingSessionLiveEvent.findMany.mockResolvedValue([
      ...connected("STUDENT"),
      ...connected("TEACHER"),
      {
        providerEventRef: "evt-room",
        sessionId: "session-1",
        type: "ROOM_ENDED",
        occurredAt: END_AT,
        providerParticipantRef: null,
        connectionRef: null,
      },
    ]);

    const result = await completeLiveSpeakingSession("session-1", {
      asOf: new Date("2026-08-20T10:16:00.000Z"),
      policy: POLICY,
    });

    expect(result).toMatchObject({
      completed: false,
      reason: "EVIDENCE_NOT_FINAL",
    });
    expect(mocks.tx.speakingSession.updateMany).not.toHaveBeenCalled();
  });

  it("writes COMPLETED only when reduced evidence justifies it", async () => {
    mocks.tx.speakingSessionLiveGrant.findMany.mockResolvedValue([
      grant("STUDENT"),
      grant("TEACHER"),
    ]);
    mocks.tx.speakingSessionLiveEvent.findMany.mockResolvedValue([
      ...connected("STUDENT"),
      ...connected("TEACHER"),
    ]);

    const result = await completeLiveSpeakingSession("session-1", {
      asOf: AFTER_HORIZON,
      policy: POLICY,
    });

    expect(result).toMatchObject({
      completed: true,
      alreadyCompleted: false,
      sessionId: "session-1",
    });
    expect(mocks.tx.speakingSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        status: "SCHEDULED",
      },
      data: {
        status: "COMPLETED",
      },
    });
  });

  it("replays an already-completed decision without writing again", async () => {
    mocks.tx.speakingSession.findUnique.mockResolvedValue({
      ...scheduledSession(),
      status: "COMPLETED",
    });

    const result = await completeLiveSpeakingSession("session-1", {
      asOf: AFTER_HORIZON,
      policy: POLICY,
    });

    expect(result).toMatchObject({
      completed: true,
      alreadyCompleted: true,
    });
    expect(mocks.tx.speakingSession.updateMany).not.toHaveBeenCalled();
  });

  it("never completes a cancelled session even with full attendance", async () => {
    mocks.tx.speakingSession.findUnique.mockResolvedValue({
      ...scheduledSession(),
      status: "CANCELLED",
    });
    mocks.tx.speakingSessionLiveGrant.findMany.mockResolvedValue([
      grant("STUDENT"),
      grant("TEACHER"),
    ]);
    mocks.tx.speakingSessionLiveEvent.findMany.mockResolvedValue([
      ...connected("STUDENT"),
      ...connected("TEACHER"),
    ]);

    const result = await completeLiveSpeakingSession("session-1", {
      asOf: AFTER_HORIZON,
      policy: POLICY,
    });

    expect(result).toMatchObject({
      completed: false,
      reason: "SESSION_CANCELLED",
    });
    expect(mocks.tx.speakingSession.updateMany).not.toHaveBeenCalled();
  });
});
