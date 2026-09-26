import {
  describe,
  expect,
  it,
} from "vitest";

import {
  authorizeLiveSessionJoin,
  createLiveSessionEvidenceTimingPolicy,
  EVIDENCE_HORIZON_GRACE_POLICY_NAME,
  REJOIN_GRACE_POLICY_NAME,
  type LiveSessionJoinSessionSnapshot,
} from "@/lib/domain/live-session/policy";

const session:
  LiveSessionJoinSessionSnapshot = {
    id:
      "session-1",

    status:
      "SCHEDULED",

    startAt:
      new Date(
        "2026-08-20T10:00:00.000Z",
      ),

    endAt:
      new Date(
        "2026-08-20T10:15:00.000Z",
      ),

    studentUserId:
      "student-user",

    teacherUserId:
      "teacher-user",
  };

const joinWindow = {
  opensAt:
    new Date(
      "2026-08-20T09:55:00.000Z",
    ),

  closesAt:
    new Date(
      "2026-08-20T10:20:00.000Z",
    ),
};

describe(
  "Wave 3 live-session policy",
  () => {
    it(
      "keeps REJOIN_GRACE and EVIDENCE_HORIZON_GRACE independent",
      () => {
        expect(
          REJOIN_GRACE_POLICY_NAME,
        ).toBe(
          "REJOIN_GRACE",
        );

        expect(
          EVIDENCE_HORIZON_GRACE_POLICY_NAME,
        ).toBe(
          "EVIDENCE_HORIZON_GRACE",
        );

        const policy =
          createLiveSessionEvidenceTimingPolicy({
            /*
             * Test fixture values only.
             * These are not production policy defaults.
             */
            rejoinGraceMs:
              45_000,

            evidenceHorizonGraceMs:
              120_000,
          });

        expect(
          policy,
        ).toEqual({
          rejoinGraceMs:
            45_000,

          evidenceHorizonGraceMs:
            120_000,
        });

        expect(
          Object.isFrozen(
            policy,
          ),
        ).toBe(
          true,
        );
      },
    );

    it.each([
      {
        rejoinGraceMs:
          -1,

        evidenceHorizonGraceMs:
          1,
      },
      {
        rejoinGraceMs:
          1.5,

        evidenceHorizonGraceMs:
          1,
      },
      {
        rejoinGraceMs:
          1,

        evidenceHorizonGraceMs:
          -1,
      },
      {
        rejoinGraceMs:
          1,

        evidenceHorizonGraceMs:
          Number.POSITIVE_INFINITY,
      },
    ])(
      "rejects invalid evidence timing policy values",
      (candidate) => {
        expect(() =>
          createLiveSessionEvidenceTimingPolicy(
            candidate,
          ),
        ).toThrow(
          RangeError,
        );
      },
    );

    it.each([
      {
        userId:
          "student-user",

        participantRole:
          "STUDENT" as const,
      },
      {
        userId:
          "teacher-user",

        participantRole:
          "TEACHER" as const,
      },
    ])(
      "authorizes $participantRole inside the explicit join window",
      ({
        userId,
        participantRole,
      }) => {
        expect(
          authorizeLiveSessionJoin({
            session,

            actor: {
              userId,

              active:
                true,
            },

            joinWindow,

            asOf:
              new Date(
                "2026-08-20T10:01:00.000Z",
              ),
          }),
        ).toEqual({
          allowed:
            true,

          participantRole,
        });
      },
    );

    it(
      "rejects a non-participant before disclosing account, state, or timing eligibility",
      () => {
        expect(
          authorizeLiveSessionJoin({
            session: {
              ...session,

              status:
                "CANCELLED",
            },

            actor: {
              userId:
                "other-user",

              active:
                false,
            },

            joinWindow,

            asOf:
              new Date(
                "2026-08-20T09:00:00.000Z",
              ),
          }),
        ).toEqual({
          allowed:
            false,

          reason:
            "NOT_PARTICIPANT",
        });
      },
    );

    it(
      "rejects an inactive authenticated participant",
      () => {
        expect(
          authorizeLiveSessionJoin({
            session,

            actor: {
              userId:
                "student-user",

              active:
                false,
            },

            joinWindow,

            asOf:
              new Date(
                "2026-08-20T10:01:00.000Z",
              ),
          }),
        ).toEqual({
          allowed:
            false,

          reason:
            "ACCOUNT_INACTIVE",
        });
      },
    );

    it.each([
      "COMPLETED",
      "CANCELLED",
    ] as const)(
      "rejects a Wave 2 session in %s state",
      (status) => {
        expect(
          authorizeLiveSessionJoin({
            session: {
              ...session,

              status,
            },

            actor: {
              userId:
                "student-user",

              active:
                true,
            },

            joinWindow,

            asOf:
              new Date(
                "2026-08-20T10:01:00.000Z",
              ),
          }),
        ).toEqual({
          allowed:
            false,

          reason:
            "SESSION_NOT_JOINABLE",
        });
      },
    );

    it(
      "uses a half-open join authorization window",
      () => {
        expect(
          authorizeLiveSessionJoin({
            session,

            actor: {
              userId:
                "student-user",

              active:
                true,
            },

            joinWindow,

            asOf:
              new Date(
                "2026-08-20T09:54:59.999Z",
              ),
          }),
        ).toEqual({
          allowed:
            false,

          reason:
            "JOIN_WINDOW_NOT_OPEN",
        });

        expect(
          authorizeLiveSessionJoin({
            session,

            actor: {
              userId:
                "student-user",

              active:
                true,
            },

            joinWindow,

            asOf:
              new Date(
                joinWindow.opensAt.getTime(),
              ),
          }),
        ).toEqual({
          allowed:
            true,

          participantRole:
            "STUDENT",
        });

        expect(
          authorizeLiveSessionJoin({
            session,

            actor: {
              userId:
                "student-user",

              active:
                true,
            },

            joinWindow,

            asOf:
              new Date(
                joinWindow.closesAt.getTime(),
              ),
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
      "fails closed on malformed temporal snapshots",
      () => {
        expect(() =>
          authorizeLiveSessionJoin({
            session: {
              ...session,

              endAt:
                new Date(
                  session.startAt.getTime(),
                ),
            },

            actor: {
              userId:
                "student-user",

              active:
                true,
            },

            joinWindow,

            asOf:
              new Date(
                "2026-08-20T10:00:00.000Z",
              ),
          }),
        ).toThrow(
          RangeError,
        );

        expect(() =>
          authorizeLiveSessionJoin({
            session,

            actor: {
              userId:
                "student-user",

              active:
                true,
            },

            joinWindow,

            asOf:
              new Date(
                "invalid",
              ),
          }),
        ).toThrow(
          RangeError,
        );
      },
    );

    it(
      "fails closed when student and teacher identities collapse",
      () => {
        expect(() =>
          authorizeLiveSessionJoin({
            session: {
              ...session,

              teacherUserId:
                "student-user",
            },

            actor: {
              userId:
                "student-user",

              active:
                true,
            },

            joinWindow,

            asOf:
              new Date(
                "2026-08-20T10:00:00.000Z",
              ),
          }),
        ).toThrow(
          RangeError,
        );
      },
    );
  },
);
