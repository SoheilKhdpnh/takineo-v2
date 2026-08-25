import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    speakingSession: {
      findUnique: vi.fn(),
    },
    speakingSessionLiveEvent: {
      create: vi.fn(),
    },
    speakingSessionLiveGrant: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mocks.prisma,
}));

import {
  LiveSessionUnknownSessionError,
} from "@/lib/errors/live-session-errors";
import {
  LIVE_SESSION_CONSTRAINT,
} from "@/lib/live-session/constraint-identity";
import {
  ingestLiveSessionProviderEvent,
} from "@/lib/services/live-session-webhook.service";
import {
  makeUniqueConstraintError,
} from "@/tests/unit/live-session/prisma-error";

const ROOM_ENDED = {
  type: "ROOM_ENDED" as const,
  providerEventRef: "evt-1",
  sessionId: "session-1",
  occurredAt: new Date("2026-08-20T10:15:00.000Z"),
};

describe("live-session webhook ingestion", () => {
  beforeEach(() => {
    mocks.prisma.speakingSession.findUnique.mockResolvedValue({
      id: "session-1",
    });
    mocks.prisma.speakingSessionLiveEvent.create.mockResolvedValue({
      id: "event-1",
    });
  });

  it("persists raw evidence for a known session", async () => {
    const result = await ingestLiveSessionProviderEvent(ROOM_ENDED);

    expect(result).toEqual({
      ingested: true,
      duplicate: false,
    });
    expect(mocks.prisma.speakingSessionLiveEvent.create).toHaveBeenCalledWith({
      data: {
        sessionId: "session-1",
        providerEventRef: "evt-1",
        type: "ROOM_ENDED",
        occurredAt: ROOM_ENDED.occurredAt,
        providerParticipantRef: null,
        connectionRef: null,
      },
      select: { id: true },
    });
  });

  it("rejects events that do not resolve to a known session", async () => {
    mocks.prisma.speakingSession.findUnique.mockResolvedValue(null);

    await expect(
      ingestLiveSessionProviderEvent(ROOM_ENDED),
    ).rejects.toBeInstanceOf(LiveSessionUnknownSessionError);

    expect(mocks.prisma.speakingSessionLiveEvent.create).not.toHaveBeenCalled();
  });

  it("treats a duplicate providerEventRef as a database no-op", async () => {
    mocks.prisma.speakingSessionLiveEvent.create.mockRejectedValue(
      makeUniqueConstraintError(
        LIVE_SESSION_CONSTRAINT.EVENT_PROVIDER_EVENT,
        "SpeakingSessionLiveEvent",
        ["providerEventRef"],
      ),
    );

    await expect(
      ingestLiveSessionProviderEvent(ROOM_ENDED),
    ).resolves.toEqual({
      ingested: false,
      duplicate: true,
    });
  });
});
