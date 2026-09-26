import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  reduceLiveSessionEvidence,
} from "@/lib/domain/live-session/evidence";
import type {
  LiveSessionCredentialGrant,
  LiveSessionParticipantConnectedEvent,
  LiveSessionParticipantDisconnectedEvent,
  LiveSessionProviderEvidenceEvent,
  LiveSessionRoomEndedEvent,
} from "@/lib/domain/live-session/provider";

const session = {
  id:
    "session-1",

  startAt:
    new Date(
      "2026-08-20T10:00:00.000Z",
    ),

  endAt:
    new Date(
      "2026-08-20T10:15:00.000Z",
    ),
};

const policy = {
  rejoinGraceMs:
    45_000,

  evidenceHorizonGraceMs:
    120_000,
};

function grant(
  providerParticipantRef:
    string,
  overrides:
    Partial<LiveSessionCredentialGrant> = {},
): LiveSessionCredentialGrant {
  return {
    grantId:
      `grant-${providerParticipantRef}`,

    sessionId:
      "session-1",

    clientJoinAttemptId:
      `attempt-${providerParticipantRef}`,

    participantUserId:
      "student-user",

    participantRole:
      "STUDENT",

    providerParticipantRef,

    authorizedAt:
      new Date(
        "2026-08-20T09:59:00.000Z",
      ),

    ...overrides,
  };
}

function connected(
  providerEventRef:
    string,
  occurredAt:
    string,
  providerParticipantRef =
    "provider-participant-1",
  connectionRef =
    "connection-1",
): LiveSessionParticipantConnectedEvent {
  return {
    type:
      "PARTICIPANT_CONNECTED",

    providerEventRef,

    sessionId:
      "session-1",

    occurredAt:
      new Date(
        occurredAt,
      ),

    providerParticipantRef,

    connectionRef,
  };
}

function disconnected(
  providerEventRef:
    string,
  occurredAt:
    string,
  providerParticipantRef =
    "provider-participant-1",
  connectionRef =
    "connection-1",
): LiveSessionParticipantDisconnectedEvent {
  return {
    type:
      "PARTICIPANT_DISCONNECTED",

    providerEventRef,

    sessionId:
      "session-1",

    occurredAt:
      new Date(
        occurredAt,
      ),

    providerParticipantRef,

    connectionRef,
  };
}

function roomEnded(
  providerEventRef:
    string,
  occurredAt:
    string,
): LiveSessionRoomEndedEvent {
  return {
    type:
      "ROOM_ENDED",

    providerEventRef,

    sessionId:
      "session-1",

    occurredAt:
      new Date(
        occurredAt,
      ),
  };
}

describe(
  "Wave 3 live-session evidence reducer",
  () => {
    it(
      "analytically bounds an open connection without fabricating a disconnect event",
      () => {
        const events = [
          connected(
            "event-connect",
            "2026-08-20T10:00:00.000Z",
          ),
        ] as const;

        const result =
          reduceLiveSessionEvidence({
            session,
            grants: [
              grant(
                "provider-participant-1",
              ),
            ],
            events,
            policy,
            asOf:
              new Date(
                "2026-08-20T10:30:00.000Z",
              ),
          });

        expect(
          result.analyticalHorizonAt,
        ).toEqual(
          new Date(
            "2026-08-20T10:17:00.000Z",
          ),
        );

        expect(
          result.participants[0],
        ).toMatchObject({
          presenceMs:
            17 * 60_000,

          reconnectCount:
            0,

          evidenceQuality:
            "OPEN_AT_HORIZON",

          openConnectionCount:
            1,
        });

        expect(
          result.participants[0]
            .intervals[0],
        ).toMatchObject({
          endedAt:
            new Date(
              "2026-08-20T10:17:00.000Z",
            ),

          intervalEndReason:
            "ANALYTICAL_HORIZON",

          evidenceQuality:
            "OPEN_AT_HORIZON",
        });

        expect(
          events,
        ).toHaveLength(1);

        expect(
          events[0].type,
        ).toBe(
          "PARTICIPANT_CONNECTED",
        );
      },
    );

    it(
      "lets ROOM_ENDED bound analysis without creating participant disconnect evidence",
      () => {
        const events:
          LiveSessionProviderEvidenceEvent[] = [
            connected(
              "event-connect",
              "2026-08-20T10:00:00.000Z",
            ),
            roomEnded(
              "event-room-ended",
              "2026-08-20T10:10:00.000Z",
            ),
          ];

        const result =
          reduceLiveSessionEvidence({
            session,
            grants: [
              grant(
                "provider-participant-1",
              ),
            ],
            events,
            policy,
            asOf:
              new Date(
                "2026-08-20T10:30:00.000Z",
              ),
          });

        expect(
          result.roomEndedAt,
        ).toEqual(
          new Date(
            "2026-08-20T10:10:00.000Z",
          ),
        );

        expect(
          result.participants[0],
        ).toMatchObject({
          presenceMs:
            10 * 60_000,

          evidenceQuality:
            "OPEN_AT_HORIZON",

          openConnectionCount:
            1,
        });

        expect(
          result.participants[0]
            .intervals[0]
            .intervalEndReason,
        ).toBe(
          "ROOM_ENDED",
        );

        expect(
          events.some(
            (event) =>
              event.type ===
              "PARTICIPANT_DISCONNECTED",
          ),
        ).toBe(
          false,
        );
      },
    );

    it(
      "lets late authentic disconnect evidence upgrade quality after ROOM_ENDED",
      () => {
        const result =
          reduceLiveSessionEvidence({
            session,
            grants: [
              grant(
                "provider-participant-1",
              ),
            ],
            events: [
              connected(
                "event-connect",
                "2026-08-20T10:00:00.000Z",
              ),
              roomEnded(
                "event-room-ended",
                "2026-08-20T10:10:00.000Z",
              ),
              disconnected(
                "event-disconnect",
                "2026-08-20T10:11:00.000Z",
              ),
            ],
            policy,
            asOf:
              new Date(
                "2026-08-20T10:30:00.000Z",
              ),
          });

        expect(
          result.participants[0],
        ).toMatchObject({
          presenceMs:
            10 * 60_000,

          evidenceQuality:
            "COMPLETE",

          openConnectionCount:
            0,
        });

        expect(
          result.participants[0]
            .intervals[0],
        ).toMatchObject({
          endedAt:
            new Date(
              "2026-08-20T10:10:00.000Z",
            ),

          intervalEndReason:
            "ROOM_ENDED",

          evidenceQuality:
            "COMPLETE",
        });
      },
    );

    it(
      "makes an orphan disconnect contribute zero presence without calling it an invalid sequence",
      () => {
        const result =
          reduceLiveSessionEvidence({
            session,
            grants: [
              grant(
                "provider-participant-1",
              ),
            ],
            events: [
              disconnected(
                "event-disconnect",
                "2026-08-20T10:02:00.000Z",
              ),
            ],
            policy,
            asOf:
              new Date(
                "2026-08-20T10:30:00.000Z",
              ),
          });

        expect(
          result.participants[0],
        ).toMatchObject({
          presenceMs:
            0,

          reconnectCount:
            0,

          evidenceQuality:
            "ORPHANED_DISCONNECT",

          invalidSequenceCount:
            0,

          orphanDisconnectCount:
            1,
        });

        expect(
          result.participants[0].intervals,
        ).toEqual([]);
      },
    );

    it(
      "self-corrects an orphan disconnect when delayed authentic CONNECTED evidence arrives",
      () => {
        const initially =
          reduceLiveSessionEvidence({
            session,
            grants: [
              grant(
                "provider-participant-1",
              ),
            ],
            events: [
              disconnected(
                "event-disconnect",
                "2026-08-20T10:02:00.000Z",
              ),
            ],
            policy,
            asOf:
              new Date(
                "2026-08-20T10:30:00.000Z",
              ),
          });

        const refined =
          reduceLiveSessionEvidence({
            session,
            grants: [
              grant(
                "provider-participant-1",
              ),
            ],
            events: [
              disconnected(
                "event-disconnect",
                "2026-08-20T10:02:00.000Z",
              ),
              connected(
                "event-connect-late-arrival",
                "2026-08-20T10:00:00.000Z",
              ),
            ],
            policy,
            asOf:
              new Date(
                "2026-08-20T10:30:00.000Z",
              ),
          });

        expect(
          initially.participants[0]
            .evidenceQuality,
        ).toBe(
          "ORPHANED_DISCONNECT",
        );

        expect(
          refined.participants[0],
        ).toMatchObject({
          presenceMs:
            2 * 60_000,

          evidenceQuality:
            "COMPLETE",

          invalidSequenceCount:
            0,

          orphanDisconnectCount:
            0,
        });
      },
    );

    it(
      "makes a matched disconnectedAt-before-connectedAt sequence invalid and zero-presence",
      () => {
        const result =
          reduceLiveSessionEvidence({
            session,
            grants: [
              grant(
                "provider-participant-1",
              ),
            ],
            events: [
              disconnected(
                "event-disconnect",
                "2026-08-20T10:01:00.000Z",
              ),
              connected(
                "event-connect",
                "2026-08-20T10:02:00.000Z",
              ),
            ],
            policy,
            asOf:
              new Date(
                "2026-08-20T10:30:00.000Z",
              ),
          });

        expect(
          result.participants[0],
        ).toMatchObject({
          presenceMs:
            0,

          reconnectCount:
            0,

          evidenceQuality:
            "INVALID_SEQUENCE",

          invalidSequenceCount:
            1,

          orphanDisconnectCount:
            0,
        });

        expect(
          result.participants[0].intervals,
        ).toEqual([]);
      },
    );

    it(
      "unions simultaneous connections without double-counting presence or reconnects",
      () => {
        const result =
          reduceLiveSessionEvidence({
            session,
            grants: [
              grant(
                "provider-participant-1",
              ),
            ],
            events: [
              connected(
                "connect-a",
                "2026-08-20T10:00:00.000Z",
                "provider-participant-1",
                "connection-a",
              ),
              connected(
                "connect-b",
                "2026-08-20T10:01:00.000Z",
                "provider-participant-1",
                "connection-b",
              ),
              disconnected(
                "disconnect-a",
                "2026-08-20T10:02:00.000Z",
                "provider-participant-1",
                "connection-a",
              ),
              disconnected(
                "disconnect-b",
                "2026-08-20T10:03:00.000Z",
                "provider-participant-1",
                "connection-b",
              ),
            ],
            policy,
            asOf:
              new Date(
                "2026-08-20T10:30:00.000Z",
              ),
          });

        expect(
          result.participants[0],
        ).toMatchObject({
          presenceMs:
            3 * 60_000,

          reconnectCount:
            0,

          evidenceQuality:
            "COMPLETE",
        });
      },
    );

    it(
      "counts only a later aggregate zero-to-one presence transition as reconnect",
      () => {
        const result =
          reduceLiveSessionEvidence({
            session,
            grants: [
              grant(
                "provider-participant-1",
              ),
              grant(
                "provider-participant-2",
                {
                  grantId:
                    "grant-2",

                  clientJoinAttemptId:
                    "attempt-2",
                },
              ),
            ],
            events: [
              connected(
                "connect-first",
                "2026-08-20T10:00:00.000Z",
              ),
              disconnected(
                "disconnect-first",
                "2026-08-20T10:02:00.000Z",
              ),
              connected(
                "connect-second",
                "2026-08-20T10:04:00.000Z",
                "provider-participant-2",
                "connection-2",
              ),
              disconnected(
                "disconnect-second",
                "2026-08-20T10:05:00.000Z",
                "provider-participant-2",
                "connection-2",
              ),
            ],
            policy,
            asOf:
              new Date(
                "2026-08-20T10:30:00.000Z",
              ),
          });

        expect(
          result.participants[0],
        ).toMatchObject({
          presenceMs:
            3 * 60_000,

          reconnectCount:
            1,

          evidenceQuality:
            "COMPLETE",
        });
      },
    );

    it(
      "keeps REJOIN_GRACE independent from evidence-horizon and reconnect computation",
      () => {
        const inputEvents = [
          connected(
            "connect-first",
            "2026-08-20T10:00:00.000Z",
          ),
          disconnected(
            "disconnect-first",
            "2026-08-20T10:02:00.000Z",
          ),
          connected(
            "connect-second",
            "2026-08-20T10:04:00.000Z",
            "provider-participant-2",
            "connection-2",
          ),
          disconnected(
            "disconnect-second",
            "2026-08-20T10:05:00.000Z",
            "provider-participant-2",
            "connection-2",
          ),
        ];

        const grants = [
          grant(
            "provider-participant-1",
          ),
          grant(
            "provider-participant-2",
            {
              grantId:
                "grant-2",

              clientJoinAttemptId:
                "attempt-2",
            },
          ),
        ];

        const first =
          reduceLiveSessionEvidence({
            session,
            grants,
            events:
              inputEvents,
            policy: {
              rejoinGraceMs:
                0,

              evidenceHorizonGraceMs:
                120_000,
            },
            asOf:
              new Date(
                "2026-08-20T10:30:00.000Z",
              ),
          });

        const second =
          reduceLiveSessionEvidence({
            session,
            grants,
            events:
              inputEvents,
            policy: {
              rejoinGraceMs:
                999_999,

              evidenceHorizonGraceMs:
                120_000,
            },
            asOf:
              new Date(
                "2026-08-20T10:30:00.000Z",
              ),
          });

        expect(
          second.liveEvidenceHorizonAt,
        ).toEqual(
          first.liveEvidenceHorizonAt,
        );

        expect(
          second.participants[0]
            .reconnectCount,
        ).toBe(
          first.participants[0]
            .reconnectCount,
        );
      },
    );

    it(
      "deduplicates exact provider-event retries by providerEventRef",
      () => {
        const connect =
          connected(
            "event-connect",
            "2026-08-20T10:00:00.000Z",
          );

        const disconnect =
          disconnected(
            "event-disconnect",
            "2026-08-20T10:02:00.000Z",
          );

        const result =
          reduceLiveSessionEvidence({
            session,
            grants: [
              grant(
                "provider-participant-1",
              ),
            ],
            events: [
              connect,
              connect,
              disconnect,
              disconnect,
            ],
            policy,
            asOf:
              new Date(
                "2026-08-20T10:30:00.000Z",
              ),
          });

        expect(
          result.conflictingProviderEventRefCount,
        ).toBe(
          0,
        );

        expect(
          result.participants[0],
        ).toMatchObject({
          presenceMs:
            2 * 60_000,

          evidenceQuality:
            "COMPLETE",

          invalidSequenceCount:
            0,
        });
      },
    );

    it(
      "excludes a conflicting reused providerEventRef instead of choosing a payload arbitrarily",
      () => {
        const result =
          reduceLiveSessionEvidence({
            session,
            grants: [
              grant(
                "provider-participant-1",
              ),
            ],
            events: [
              connected(
                "conflicting-ref",
                "2026-08-20T10:00:00.000Z",
              ),
              disconnected(
                "conflicting-ref",
                "2026-08-20T10:01:00.000Z",
              ),
            ],
            policy,
            asOf:
              new Date(
                "2026-08-20T10:30:00.000Z",
              ),
          });

        expect(
          result.conflictingProviderEventRefCount,
        ).toBe(
          1,
        );

        expect(
          result.participants[0],
        ).toMatchObject({
          presenceMs:
            0,

          reconnectCount:
            0,

          evidenceQuality:
            "COMPLETE",
        });
      },
    );

    it(
      "is pure, leaves inputs ordered as supplied, and uses explicit asOf instead of Date.now",
      () => {
        const events = [
          disconnected(
            "event-disconnect",
            "2026-08-20T10:04:00.000Z",
          ),
          connected(
            "event-connect",
            "2026-08-20T10:00:00.000Z",
          ),
        ];

        const originalOrder =
          events.map(
            (event) =>
              event.providerEventRef,
          );

        const nowSpy =
          vi.spyOn(
            Date,
            "now",
          ).mockImplementation(
            () => {
              throw new Error(
                "Date.now must not be used by the evidence reducer.",
              );
            },
          );

        try {
          const result =
            reduceLiveSessionEvidence({
              session,
              grants: [
                grant(
                  "provider-participant-1",
                ),
              ],
              events,
              policy,
              asOf:
                new Date(
                  "2026-08-20T10:03:00.000Z",
                ),
            });

          expect(
            result.liveEvidenceHorizonAt,
          ).toEqual(
            new Date(
              "2026-08-20T10:03:00.000Z",
            ),
          );

          expect(
            result.participants[0]
              .presenceMs,
          ).toBe(
            3 * 60_000,
          );

          expect(
            events.map(
              (event) =>
                event.providerEventRef,
            ),
          ).toEqual(
            originalOrder,
          );
        }
        finally {
          nowSpy.mockRestore();
        }
      },
    );
  },
);
