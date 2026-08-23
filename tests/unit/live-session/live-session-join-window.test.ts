import {
  describe,
  expect,
  it,
} from "vitest";

import {
  authorizeLiveSessionJoin,
  createLiveSessionEvidenceTimingPolicy,
  deriveLiveSessionJoinWindow,
  type LiveSessionEvidenceTimingPolicy,
  type LiveSessionJoinSessionSnapshot,
} from "@/lib/domain/live-session/policy";
import {
  reduceLiveSessionEvidence,
} from "@/lib/domain/live-session/evidence";

const SESSION_START =
  new Date(
    "2026-08-20T10:00:00.000Z",
  );

const SESSION_END =
  new Date(
    "2026-08-20T10:15:00.000Z",
  );

const REJOIN_GRACE_MS =
  120_000;

const EVIDENCE_HORIZON_GRACE_MS =
  300_000;

function policy(
  overrides:
    Partial<LiveSessionEvidenceTimingPolicy> = {},
): LiveSessionEvidenceTimingPolicy {
  return createLiveSessionEvidenceTimingPolicy({
    rejoinGraceMs:
      REJOIN_GRACE_MS,

    evidenceHorizonGraceMs:
      EVIDENCE_HORIZON_GRACE_MS,

    ...overrides,
  });
}

function session(
  overrides:
    Partial<LiveSessionJoinSessionSnapshot> = {},
): LiveSessionJoinSessionSnapshot {
  return {
    id:
      "session-1",

    status:
      "SCHEDULED",

    startAt:
      SESSION_START,

    endAt:
      SESSION_END,

    studentUserId:
      "student-user",

    teacherUserId:
      "teacher-user",

    ...overrides,
  };
}

describe(
  "Wave 3 live-session join window",
  () => {
    it(
      "opens at the booked start without inventing an early-join allowance",
      () => {
        const window =
          deriveLiveSessionJoinWindow({
            session: {
              startAt:
                SESSION_START,

              endAt:
                SESSION_END,
            },

            policy:
              policy(),
          });

        expect(
          window.opensAt,
        ).toEqual(
          SESSION_START,
        );
      },
    );

    it(
      "closes REJOIN_GRACE after the booked end",
      () => {
        const window =
          deriveLiveSessionJoinWindow({
            session: {
              startAt:
                SESSION_START,

              endAt:
                SESSION_END,
            },

            policy:
              policy(),
          });

        expect(
          window.closesAt,
        ).toEqual(
          new Date(
            "2026-08-20T10:17:00.000Z",
          ),
        );
      },
    );

    it(
      "closes exactly at the booked end when REJOIN_GRACE is zero",
      () => {
        const window =
          deriveLiveSessionJoinWindow({
            session: {
              startAt:
                SESSION_START,

              endAt:
                SESSION_END,
            },

            policy:
              policy({
                rejoinGraceMs:
                  0,
              }),
          });

        expect(
          window.closesAt,
        ).toEqual(
          SESSION_END,
        );
      },
    );

    it(
      "keeps EVIDENCE_HORIZON_GRACE from widening the authorization window",
      () => {
        const narrow =
          deriveLiveSessionJoinWindow({
            session: {
              startAt:
                SESSION_START,

              endAt:
                SESSION_END,
            },

            policy:
              policy({
                evidenceHorizonGraceMs:
                  0,
              }),
          });

        const wide =
          deriveLiveSessionJoinWindow({
            session: {
              startAt:
                SESSION_START,

              endAt:
                SESSION_END,
            },

            policy:
              policy({
                evidenceHorizonGraceMs:
                  3_600_000,
              }),
          });

        expect(
          wide.opensAt,
        ).toEqual(
          narrow.opensAt,
        );

        expect(
          wide.closesAt,
        ).toEqual(
          narrow.closesAt,
        );
      },
    );

    it(
      "keeps REJOIN_GRACE from moving the analytical evidence horizon",
      () => {
        const asOf =
          new Date(
            "2026-08-20T10:30:00.000Z",
          );

        const reduce = (
          rejoinGraceMs:
            number,
        ) =>
          reduceLiveSessionEvidence({
            session: {
              id:
                "session-1",

              startAt:
                SESSION_START,

              endAt:
                SESSION_END,
            },

            grants:
              [],

            events:
              [],

            policy:
              policy({
                rejoinGraceMs,
              }),

            asOf,
          });

        expect(
          reduce(
            3_600_000,
          ).analyticalHorizonAt,
        ).toEqual(
          reduce(
            0,
          ).analyticalHorizonAt,
        );
      },
    );

    it(
      "produces a window that authorizes the opening instant and denies the closing instant",
      () => {
        const window =
          deriveLiveSessionJoinWindow({
            session: {
              startAt:
                SESSION_START,

              endAt:
                SESSION_END,
            },

            policy:
              policy(),
          });

        expect(
          authorizeLiveSessionJoin({
            session:
              session(),

            actor: {
              userId:
                "student-user",

              active:
                true,
            },

            joinWindow:
              window,

            asOf:
              window.opensAt,
          }),
        ).toEqual({
          allowed:
            true,

          participantRole:
            "STUDENT",
        });

        expect(
          authorizeLiveSessionJoin({
            session:
              session(),

            actor: {
              userId:
                "student-user",

              active:
                true,
            },

            joinWindow:
              window,

            asOf:
              window.closesAt,
          }),
        ).toEqual({
          allowed:
            false,

          reason:
            "JOIN_WINDOW_CLOSED",
        });
      },
    );

    it(
      "allows a rejoin after the booked end but inside REJOIN_GRACE",
      () => {
        const window =
          deriveLiveSessionJoinWindow({
            session: {
              startAt:
                SESSION_START,

              endAt:
                SESSION_END,
            },

            policy:
              policy(),
          });

        expect(
          authorizeLiveSessionJoin({
            session:
              session(),

            actor: {
              userId:
                "teacher-user",

              active:
                true,
            },

            joinWindow:
              window,

            asOf:
              new Date(
                "2026-08-20T10:16:00.000Z",
              ),
          }),
        ).toEqual({
          allowed:
            true,

          participantRole:
            "TEACHER",
        });
      },
    );

    it(
      "returns a frozen window",
      () => {
        const window =
          deriveLiveSessionJoinWindow({
            session: {
              startAt:
                SESSION_START,

              endAt:
                SESSION_END,
            },

            policy:
              policy(),
          });

        expect(
          Object.isFrozen(
            window,
          ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "rejects a schedule that does not move forward",
      () => {
        expect(
          () =>
            deriveLiveSessionJoinWindow({
              session: {
                startAt:
                  SESSION_END,

                endAt:
                  SESSION_START,
              },

              policy:
                policy(),
            }),
        ).toThrow(
          RangeError,
        );
      },
    );

    it(
      "rejects an invalid schedule date",
      () => {
        expect(
          () =>
            deriveLiveSessionJoinWindow({
              session: {
                startAt:
                  new Date(
                    Number.NaN,
                  ),

                endAt:
                  SESSION_END,
              },

              policy:
                policy(),
            }),
        ).toThrow(
          RangeError,
        );
      },
    );

    it(
      "refuses to guess a missing grace value",
      () => {
        expect(
          () =>
            createLiveSessionEvidenceTimingPolicy({
              rejoinGraceMs:
                -1,

              evidenceHorizonGraceMs:
                EVIDENCE_HORIZON_GRACE_MS,
            }),
        ).toThrow(
          RangeError,
        );

        expect(
          () =>
            createLiveSessionEvidenceTimingPolicy({
              rejoinGraceMs:
                REJOIN_GRACE_MS,

              evidenceHorizonGraceMs:
                1.5,
            }),
        ).toThrow(
          RangeError,
        );
      },
    );
  },
);
