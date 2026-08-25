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
    user: {
      findUnique: vi.fn(),
    },
    speakingSession: {
      findUnique: vi.fn(),
    },
    speakingSessionLiveGrant: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };

  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
    },
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: mocks.prisma,
}));

import {
  LiveSessionJoinAttemptConflictError,
  LiveSessionJoinDeniedError,
  LiveSessionTargetNotFoundError,
} from "@/lib/errors/live-session-errors";
import {
  createFakeLiveSessionProvider,
} from "@/lib/live-session/fake-provider";
import {
  LIVE_SESSION_CONSTRAINT,
} from "@/lib/live-session/constraint-identity";
import {
  issueLiveSessionJoinGrant,
} from "@/lib/services/live-session-grant.service";
import {
  makeUniqueConstraintError,
} from "@/tests/unit/live-session/prisma-error";

const START_AT = new Date("2026-08-20T10:00:00.000Z");
const END_AT = new Date("2026-08-20T10:15:00.000Z");
const POLICY = {
  rejoinGraceMs: 120_000,
  evidenceHorizonGraceMs: 300_000,
} as const;

function provider() {
  return createFakeLiveSessionProvider({
    webhookSecret: "s".repeat(32),
    now: () => START_AT,
  });
}

function scheduledSession() {
  return {
    id: "session-1",
    status: "SCHEDULED",
    startAt: START_AT,
    endAt: END_AT,
    studentUserId: "student-user",
    teacherProfile: {
      userId: "teacher-user",
    },
  };
}

function activeUser(id: string) {
  return {
    id,
    accountStatus: "ACTIVE",
  };
}

describe("live-session grant issuance", () => {
  beforeEach(() => {
    mocks.prisma.$transaction.mockImplementation(
      async (work: (tx: typeof mocks.tx) => Promise<unknown>) =>
        work(mocks.tx),
    );
    mocks.tx.$executeRaw.mockResolvedValue(undefined);
    mocks.tx.user.findUnique.mockResolvedValue(activeUser("student-user"));
    mocks.tx.speakingSession.findUnique.mockResolvedValue(
      scheduledSession(),
    );
    mocks.tx.speakingSessionLiveGrant.findUnique.mockResolvedValue(null);
    mocks.tx.speakingSessionLiveGrant.create.mockImplementation(
      async ({ data }: { data: Record<string, string> }) => ({
        id: "grant-1",
        sessionId: data.sessionId,
        participantUserId: data.participantUserId,
        participantRole: data.participantRole,
        clientJoinAttemptId: data.clientJoinAttemptId,
        providerParticipantRef: data.providerParticipantRef,
        authorizedAt: START_AT,
      }),
    );
  });

  it("issues a grant for a participant inside the join window", async () => {
    const result = await issueLiveSessionJoinGrant(
      "student-user",
      {
        sessionId: "session-1",
        clientJoinAttemptId: "attempt-1",
      },
      {
        asOf: START_AT,
        policy: POLICY,
        provider: provider(),
      },
    );

    expect(result.replayed).toBe(false);
    expect(result.grant.participantRole).toBe("STUDENT");
    expect(result.credential.startsWith("fake-live:")).toBe(true);
    expect(result.grant.providerParticipantRef).not.toBe("student-user");
  });

  it("replays the same join attempt instead of minting a second grant", async () => {
    mocks.tx.speakingSessionLiveGrant.findUnique.mockResolvedValue({
      id: "grant-1",
      sessionId: "session-1",
      participantUserId: "student-user",
      participantRole: "STUDENT",
      clientJoinAttemptId: "attempt-1",
      providerParticipantRef: "fake-ppr:existing",
      authorizedAt: START_AT,
    });

    const result = await issueLiveSessionJoinGrant(
      "student-user",
      {
        sessionId: "session-1",
        clientJoinAttemptId: "attempt-1",
      },
      {
        asOf: START_AT,
        policy: POLICY,
        provider: provider(),
      },
    );

    expect(result.replayed).toBe(true);
    expect(result.grant.grantId).toBe("grant-1");
    expect(mocks.tx.speakingSessionLiveGrant.create).not.toHaveBeenCalled();
  });

  it("rejects a reused join attempt that belongs to a different session", async () => {
    mocks.tx.speakingSessionLiveGrant.findUnique.mockResolvedValue({
      id: "grant-other",
      sessionId: "session-other",
      participantUserId: "student-user",
      participantRole: "STUDENT",
      clientJoinAttemptId: "attempt-1",
      providerParticipantRef: "fake-ppr:other",
      authorizedAt: START_AT,
    });

    await expect(
      issueLiveSessionJoinGrant(
        "student-user",
        {
          sessionId: "session-1",
          clientJoinAttemptId: "attempt-1",
        },
        {
          asOf: START_AT,
          policy: POLICY,
          provider: provider(),
        },
      ),
    ).rejects.toBeInstanceOf(LiveSessionJoinAttemptConflictError);
  });

  it("treats a join-attempt unique collision as an idempotent replay", async () => {
    mocks.tx.speakingSessionLiveGrant.create.mockRejectedValueOnce(
      makeUniqueConstraintError(
        LIVE_SESSION_CONSTRAINT.GRANT_JOIN_ATTEMPT,
        "SpeakingSessionLiveGrant",
        ["participantUserId", "clientJoinAttemptId"],
      ),
    );
    mocks.tx.speakingSessionLiveGrant.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "grant-raced",
        sessionId: "session-1",
        participantUserId: "student-user",
        participantRole: "STUDENT",
        clientJoinAttemptId: "attempt-1",
        providerParticipantRef: "fake-ppr:raced",
        authorizedAt: START_AT,
      });

    const result = await issueLiveSessionJoinGrant(
      "student-user",
      {
        sessionId: "session-1",
        clientJoinAttemptId: "attempt-1",
      },
      {
        asOf: START_AT,
        policy: POLICY,
        provider: provider(),
      },
    );

    expect(result.replayed).toBe(true);
    expect(result.grant.grantId).toBe("grant-raced");
  });

  it.each([
    ["NOT_PARTICIPANT", "stranger-user", START_AT, "SCHEDULED"],
    ["SESSION_NOT_JOINABLE", "student-user", START_AT, "CANCELLED"],
    [
      "JOIN_WINDOW_NOT_OPEN",
      "student-user",
      new Date("2026-08-20T09:59:59.000Z"),
      "SCHEDULED",
    ],
    [
      "JOIN_WINDOW_CLOSED",
      "student-user",
      new Date("2026-08-20T10:17:00.000Z"),
      "SCHEDULED",
    ],
  ] as const)(
    "denies %s server-side",
    async (reason, actorId, asOf, status) => {
      mocks.tx.user.findUnique.mockResolvedValue(activeUser(actorId));
      mocks.tx.speakingSession.findUnique.mockResolvedValue({
        ...scheduledSession(),
        status,
      });

      await expect(
        issueLiveSessionJoinGrant(
          actorId,
          {
            sessionId: "session-1",
            clientJoinAttemptId: "attempt-1",
          },
          {
            asOf,
            policy: POLICY,
            provider: provider(),
          },
        ),
      ).rejects.toMatchObject({
        name: "LiveSessionJoinDeniedError",
        reason,
      });
    },
  );

  it("denies an inactive participant without minting a grant", async () => {
    mocks.tx.user.findUnique.mockResolvedValue({
      id: "student-user",
      accountStatus: "SUSPENDED",
    });

    await expect(
      issueLiveSessionJoinGrant(
        "student-user",
        {
          sessionId: "session-1",
          clientJoinAttemptId: "attempt-1",
        },
        {
          asOf: START_AT,
          policy: POLICY,
          provider: provider(),
        },
      ),
    ).rejects.toMatchObject({
      name: LiveSessionJoinDeniedError.name,
      reason: "ACCOUNT_INACTIVE",
    });

    expect(mocks.tx.speakingSessionLiveGrant.create).not.toHaveBeenCalled();
  });

  it("does not leak session state to a missing session id", async () => {
    mocks.tx.speakingSession.findUnique.mockResolvedValue(null);

    await expect(
      issueLiveSessionJoinGrant(
        "student-user",
        {
          sessionId: "missing",
          clientJoinAttemptId: "attempt-1",
        },
        {
          asOf: START_AT,
          policy: POLICY,
          provider: provider(),
        },
      ),
    ).rejects.toBeInstanceOf(LiveSessionTargetNotFoundError);
  });
});
