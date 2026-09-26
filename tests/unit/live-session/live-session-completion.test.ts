import {
  describe,
  expect,
  it,
} from "vitest";

import {
  decideLiveSessionCompletion,
  type LiveSessionCompletionSessionSnapshot,
} from "@/lib/domain/live-session/completion";
import {
  reduceLiveSessionEvidence,
  type LiveSessionEvidenceReduction,
} from "@/lib/domain/live-session/evidence";
import {
  createLiveSessionEvidenceTimingPolicy,
} from "@/lib/domain/live-session/policy";
import type {
  LiveSessionCredentialGrant,
  LiveSessionProviderEvidenceEvent,
} from "@/lib/domain/live-session/provider";

const SESSION_ID =
  "session-1";

const SESSION_START =
  new Date(
    "2026-08-20T10:00:00.000Z",
  );

const SESSION_END =
  new Date(
    "2026-08-20T10:15:00.000Z",
  );

const EVIDENCE_HORIZON_GRACE_MS =
  120_000;

/**
 * endAt + EVIDENCE_HORIZON_GRACE.
 */
const ANALYTICAL_HORIZON =
  new Date(
    "2026-08-20T10:17:00.000Z",
  );

const TIMING_POLICY =
  createLiveSessionEvidenceTimingPolicy({
    rejoinGraceMs:
      60_000,

    evidenceHorizonGraceMs:
      EVIDENCE_HORIZON_GRACE_MS,
  });

function grant(
  role:
    "STUDENT" |
    "TEACHER",
): LiveSessionCredentialGrant {
  const slug =
    role.toLowerCase();

  return {
    grantId:
      `grant-${slug}`,

    sessionId:
      SESSION_ID,

    clientJoinAttemptId:
      `join-attempt-${slug}`,

    participantUserId:
      `${slug}-user`,

    participantRole:
      role,

    providerParticipantRef:
      `provider-participant-${slug}`,

    authorizedAt:
      SESSION_START,
  };
}

function connected(
  role:
    "STUDENT" |
    "TEACHER",
  occurredAt:
    Date,
  connectionRef =
    "connection-a",
  providerEventRef =
    `connected-${role.toLowerCase()}-${connectionRef}`,
): LiveSessionProviderEvidenceEvent {
  return {
    type:
      "PARTICIPANT_CONNECTED",

    providerEventRef,

    sessionId:
      SESSION_ID,

    occurredAt,

    providerParticipantRef:
      `provider-participant-${role.toLowerCase()}`,

    connectionRef,
  };
}

function disconnected(
  role:
    "STUDENT" |
    "TEACHER",
  occurredAt:
    Date,
  connectionRef =
    "connection-a",
): LiveSessionProviderEvidenceEvent {
  return {
    type:
      "PARTICIPANT_DISCONNECTED",

    providerEventRef:
      `disconnected-${role.toLowerCase()}-${connectionRef}`,

    sessionId:
      SESSION_ID,

    occurredAt,

    providerParticipantRef:
      `provider-participant-${role.toLowerCase()}`,

    connectionRef,
  };
}

function reduce(
  input: Readonly<{
    grants:
      readonly LiveSessionCredentialGrant[];

    events:
      readonly LiveSessionProviderEvidenceEvent[];

    asOf:
      Date;
  }>,
): LiveSessionEvidenceReduction {
  return reduceLiveSessionEvidence({
    session: {
      id:
        SESSION_ID,

      startAt:
        SESSION_START,

      endAt:
        SESSION_END,
    },

    grants:
      input.grants,

    events:
      input.events,

    policy:
      TIMING_POLICY,

    asOf:
      input.asOf,
  });
}

function bothAttended(
  asOf:
    Date,
): LiveSessionEvidenceReduction {
  return reduce({
    grants: [
      grant(
        "STUDENT",
      ),
      grant(
        "TEACHER",
      ),
    ],

    events: [
      connected(
        "STUDENT",
        SESSION_START,
      ),
      disconnected(
        "STUDENT",
        SESSION_END,
      ),
      connected(
        "TEACHER",
        SESSION_START,
      ),
      disconnected(
        "TEACHER",
        SESSION_END,
      ),
    ],

    asOf,
  });
}

function session(
  overrides:
    Partial<LiveSessionCompletionSessionSnapshot> = {},
): LiveSessionCompletionSessionSnapshot {
  return {
    id:
      SESSION_ID,

    status:
      "SCHEDULED",

    startAt:
      SESSION_START,

    endAt:
      SESSION_END,

    ...overrides,
  };
}

describe(
  "Wave 3 live-session completion decision",
  () => {
    it(
      "completes a session both participants attended once evidence is final",
      () => {
        const decision =
          decideLiveSessionCompletion({
            session:
              session(),

            reduction:
              bothAttended(
                ANALYTICAL_HORIZON,
              ),

            asOf:
              ANALYTICAL_HORIZON,
          });

        expect(
          decision,
        ).toEqual({
          completable:
            true,

          effectiveAt:
            ANALYTICAL_HORIZON,

          studentPresenceMs:
            900_000,

          teacherPresenceMs:
            900_000,
        });
      },
    );

    it(
      "refuses to complete an elapsed session before the analytical horizon",
      () => {
        const asOf =
          new Date(
            "2026-08-20T10:16:00.000Z",
          );

        const decision =
          decideLiveSessionCompletion({
            session:
              session(),

            reduction:
              bothAttended(
                asOf,
              ),

            asOf,
          });

        expect(
          decision,
        ).toEqual({
          completable:
            false,

          reason:
            "EVIDENCE_NOT_FINAL",
        });
      },
    );

    it(
      "still refuses before the horizon even after ROOM_ENDED",
      () => {
        const asOf =
          new Date(
            "2026-08-20T10:16:00.000Z",
          );

        const reduction =
          reduce({
            grants: [
              grant(
                "STUDENT",
              ),
              grant(
                "TEACHER",
              ),
            ],

            events: [
              connected(
                "STUDENT",
                SESSION_START,
              ),
              disconnected(
                "STUDENT",
                SESSION_END,
              ),
              connected(
                "TEACHER",
                SESSION_START,
              ),
              disconnected(
                "TEACHER",
                SESSION_END,
              ),
              {
                type:
                  "ROOM_ENDED",

                providerEventRef:
                  "room-ended-1",

                sessionId:
                  SESSION_ID,

                occurredAt:
                  SESSION_END,
              },
            ],

            asOf,
          });

        expect(
          reduction.roomEndedAt,
        ).toEqual(
          SESSION_END,
        );

        expect(
          decideLiveSessionCompletion({
            session:
              session(),

            reduction,

            asOf,
          }),
        ).toEqual({
          completable:
            false,

          reason:
            "EVIDENCE_NOT_FINAL",
        });
      },
    );

    it(
      "reports no presence when nobody joined",
      () => {
        const reduction =
          reduce({
            grants: [
              grant(
                "STUDENT",
              ),
              grant(
                "TEACHER",
              ),
            ],

            events:
              [],

            asOf:
              ANALYTICAL_HORIZON,
          });

        expect(
          decideLiveSessionCompletion({
            session:
              session(),

            reduction,

            asOf:
              ANALYTICAL_HORIZON,
          }),
        ).toEqual({
          completable:
            false,

          reason:
            "NO_PARTICIPANT_PRESENCE",
        });
      },
    );

    it(
      "reports incomplete participation rather than inventing a no-show status",
      () => {
        const reduction =
          reduce({
            grants: [
              grant(
                "STUDENT",
              ),
              grant(
                "TEACHER",
              ),
            ],

            events: [
              connected(
                "STUDENT",
                SESSION_START,
              ),
              disconnected(
                "STUDENT",
                SESSION_END,
              ),
            ],

            asOf:
              ANALYTICAL_HORIZON,
          });

        expect(
          decideLiveSessionCompletion({
            session:
              session(),

            reduction,

            asOf:
              ANALYTICAL_HORIZON,
          }),
        ).toEqual({
          completable:
            false,

          reason:
            "INCOMPLETE_PARTICIPATION",
        });
      },
    );

    it(
      "refuses to complete on unreliable evidence",
      () => {
        const reduction =
          reduce({
            grants: [
              grant(
                "STUDENT",
              ),
              grant(
                "TEACHER",
              ),
            ],

            events: [
              connected(
                "STUDENT",
                SESSION_START,
              ),
              disconnected(
                "STUDENT",
                SESSION_END,
              ),
              connected(
                "TEACHER",
                SESSION_START,
                "connection-a",
                "connected-teacher-first",
              ),
              connected(
                "TEACHER",
                new Date(
                  "2026-08-20T10:05:00.000Z",
                ),
                "connection-a",
                "connected-teacher-second",
              ),
            ],

            asOf:
              ANALYTICAL_HORIZON,
          });

        expect(
          reduction.participants.some(
            (participant) =>
              participant.evidenceQuality ===
              "INVALID_SEQUENCE",
          ),
        ).toBe(
          true,
        );

        expect(
          decideLiveSessionCompletion({
            session:
              session(),

            reduction,

            asOf:
              ANALYTICAL_HORIZON,
          }),
        ).toEqual({
          completable:
            false,

          reason:
            "EVIDENCE_UNRELIABLE",
        });
      },
    );

    it(
      "treats an already completed session as idempotent rather than completable",
      () => {
        expect(
          decideLiveSessionCompletion({
            session:
              session({
                status:
                  "COMPLETED",
              }),

            reduction:
              bothAttended(
                ANALYTICAL_HORIZON,
              ),

            asOf:
              ANALYTICAL_HORIZON,
          }),
        ).toEqual({
          completable:
            false,

          reason:
            "ALREADY_COMPLETED",
        });
      },
    );

    it(
      "never completes a cancelled session, even with full attendance evidence",
      () => {
        expect(
          decideLiveSessionCompletion({
            session:
              session({
                status:
                  "CANCELLED",
              }),

            reduction:
              bothAttended(
                ANALYTICAL_HORIZON,
              ),

            asOf:
              ANALYTICAL_HORIZON,
          }),
        ).toEqual({
          completable:
            false,

          reason:
            "SESSION_CANCELLED",
        });
      },
    );

    it(
      "prefers terminal status over evidence finality in the reason precedence",
      () => {
        const asOf =
          new Date(
            "2026-08-20T10:16:00.000Z",
          );

        expect(
          decideLiveSessionCompletion({
            session:
              session({
                status:
                  "CANCELLED",
              }),

            reduction:
              bothAttended(
                asOf,
              ),

            asOf,
          }),
        ).toEqual({
          completable:
            false,

          reason:
            "SESSION_CANCELLED",
        });
      },
    );

    it(
      "rejects evidence belonging to a different session",
      () => {
        expect(
          () =>
            decideLiveSessionCompletion({
              session:
                session({
                  id:
                    "session-other",
                }),

              reduction:
                bothAttended(
                  ANALYTICAL_HORIZON,
                ),

              asOf:
                ANALYTICAL_HORIZON,
            }),
        ).toThrow(
          RangeError,
        );
      },
    );

    it(
      "is pure and does not mutate the supplied reduction",
      () => {
        const reduction =
          bothAttended(
            ANALYTICAL_HORIZON,
          );

        const snapshot =
          JSON.stringify(
            reduction,
          );

        decideLiveSessionCompletion({
          session:
            session(),

          reduction,

          asOf:
            ANALYTICAL_HORIZON,
        });

        expect(
          JSON.stringify(
            reduction,
          ),
        ).toBe(
          snapshot,
        );
      },
    );
  },
);
