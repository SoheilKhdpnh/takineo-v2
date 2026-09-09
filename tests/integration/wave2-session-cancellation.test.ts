import {
  randomUUID,
} from "node:crypto";

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import {
  Client,
} from "pg";

import {
  createTestPrismaClient,
} from "@/tests/support/test-prisma-client";
import {
  getTestDatabaseUrl,
} from "@/tests/support/test-database-url";

const testDatabaseUrl =
  getTestDatabaseUrl();

const RUN_ID =
  randomUUID()
    .replaceAll(
      "-",
      "",
    )
    .slice(
      0,
      12,
    );

/*
 * Deliberately does NOT begin with
 * "it_wave2_".
 *
 * The older booking-constraint cleanup owns
 * that namespace and performs fixture deletion.
 * Cancellation history is now immutable, so
 * this suite needs an isolated namespace.
 */
const PREFIX =
  `it_cxl_${RUN_ID}`;

const IDS = {
  studentA:
    `${PREFIX}_student_a`,

  studentB:
    `${PREFIX}_student_b`,

  teacherA:
    `${PREFIX}_teacher_a`,

  teacherB:
    `${PREFIX}_teacher_b`,

  teacherProfileA:
    `${PREFIX}_profile_a`,

  teacherProfileB:
    `${PREFIX}_profile_b`,

  reviewer:
    `${PREFIX}_reviewer`,

  superAdmin:
    `${PREFIX}_super_admin`,

  reviewerAccess:
    `${PREFIX}_reviewer_access`,

  superAdminAccess:
    `${PREFIX}_super_access`,
} as const;

let fixtureClient:
  Client | null =
    null;

let applicationPrisma:
  ReturnType<
    typeof createTestPrismaClient
  > | null =
    null;

let cancelSpeakingSessionAsStudent:
  typeof import(
    "@/lib/services/session-cancellation.service"
  ).cancelSpeakingSessionAsStudent;

let cancelSpeakingSessionAsTeacher:
  typeof import(
    "@/lib/services/session-cancellation.service"
  ).cancelSpeakingSessionAsTeacher;

let cancelSpeakingSessionAsAdmin:
  typeof import(
    "@/lib/services/session-cancellation.service"
  ).cancelSpeakingSessionAsAdmin;

let SessionCancellationCutoffError:
  typeof import(
    "@/lib/errors/session-cancellation-errors"
  ).SessionCancellationCutoffError;

let SessionCancellationForbiddenError:
  typeof import(
    "@/lib/errors/session-cancellation-errors"
  ).SessionCancellationForbiddenError;

let SessionCancellationStateError:
  typeof import(
    "@/lib/errors/session-cancellation-errors"
  ).SessionCancellationStateError;

let SessionCancellationTargetNotFoundError:
  typeof import(
    "@/lib/errors/session-cancellation-errors"
  ).SessionCancellationTargetNotFoundError;

type SessionStatus =
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED";

type CancellationRow = {
  id:
    string;

  actorType:
    string;

  actorUserId:
    string | null;

  reason:
    string | null;

  cancelledAt:
    Date;
};

async function seedActors():
  Promise<void> {
  if (
    !fixtureClient
  ) {
    throw new Error(
      "Fixture client is unavailable.",
    );
  }

  await fixtureClient.query(
    `
      INSERT INTO
        "user" (
          "id",
          "name",
          "email",
          "emailVerified",
          "role",
          "accountStatus",
          "createdAt",
          "updatedAt"
        )
      VALUES
        (
          $1,
          'Cancellation Student A',
          $2,
          true,
          'STUDENT',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $3,
          'Cancellation Student B',
          $4,
          true,
          'STUDENT',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $5,
          'Cancellation Teacher A',
          $6,
          true,
          'TEACHER',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $7,
          'Cancellation Teacher B',
          $8,
          true,
          'TEACHER',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $9,
          'Cancellation Reviewer',
          $10,
          true,
          'STUDENT',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $11,
          'Cancellation Super Admin',
          $12,
          true,
          'STUDENT',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
    `,
    [
      IDS.studentA,
      `${IDS.studentA}@example.test`,

      IDS.studentB,
      `${IDS.studentB}@example.test`,

      IDS.teacherA,
      `${IDS.teacherA}@example.test`,

      IDS.teacherB,
      `${IDS.teacherB}@example.test`,

      IDS.reviewer,
      `${IDS.reviewer}@example.test`,

      IDS.superAdmin,
      `${IDS.superAdmin}@example.test`,
    ],
  );

  await fixtureClient.query(
    `
      INSERT INTO
        "teacher_profile" (
          "id",
          "userId",
          "profileCompletedAt",
          "applicationStatus",
          "createdAt",
          "updatedAt"
        )
      VALUES
        (
          $1,
          $2,
          CURRENT_TIMESTAMP,
          'APPROVED',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $3,
          $4,
          CURRENT_TIMESTAMP,
          'APPROVED',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
    `,
    [
      IDS.teacherProfileA,
      IDS.teacherA,

      IDS.teacherProfileB,
      IDS.teacherB,
    ],
  );

  await fixtureClient.query(
    `
      INSERT INTO
        "admin_access" (
          "id",
          "userId",
          "permission",
          "createdAt",
          "updatedAt"
        )
      VALUES
        (
          $1,
          $2,
          'REVIEWER',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $3,
          $4,
          'SUPER_ADMIN',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
    `,
    [
      IDS.reviewerAccess,
      IDS.reviewer,

      IDS.superAdminAccess,
      IDS.superAdmin,
    ],
  );
}

async function revokeAdminFixtureAccess():
  Promise<void> {
  if (
    !fixtureClient
  ) {
    return;
  }

  /*
   * Cancellation history is immutable and may
   * retain actorUserId indefinitely.
   *
   * Administrative authority is separate from
   * that historical identity, so test admin
   * access is revoked rather than deleted.
   */
  await fixtureClient.query(
    `
      UPDATE
        "admin_access"
      SET
        "revokedAt" =
          CURRENT_TIMESTAMP,
        "updatedAt" =
          CURRENT_TIMESTAMP
      WHERE
        "userId" IN (
          $1,
          $2
        )
        AND
        "revokedAt" IS NULL
    `,
    [
      IDS.reviewer,
      IDS.superAdmin,
    ],
  );
}

async function futureAlignedStart(
  minimumMinutesAhead:
    number,

  offsetSlots:
    number = 0,
): Promise<Date> {
  if (
    !fixtureClient
  ) {
    throw new Error(
      "Fixture client is unavailable.",
    );
  }

  const result =
    await fixtureClient.query<{
      startAt:
        Date;
    }>(
      `
        SELECT
          date_bin(
            INTERVAL '15 minutes',
            clock_timestamp()
              +
              (
                $1::int
                *
                INTERVAL '1 minute'
              ),
            TIMESTAMPTZ
              '2000-01-01 00:00:00+00'
          )
          +
          (
            ($2::int + 1)
            *
            INTERVAL '15 minutes'
          )
            AS "startAt"
      `,
      [
        minimumMinutesAhead,
        offsetSlots,
      ],
    );

  const startAt =
    result.rows[0]
      ?.startAt;

  if (
    !startAt
  ) {
    throw new Error(
      "Failed to calculate future test slot.",
    );
  }

  return startAt;
}

async function pastAlignedStart(
  minimumMinutesAgo:
    number,
): Promise<Date> {
  if (
    !fixtureClient
  ) {
    throw new Error(
      "Fixture client is unavailable.",
    );
  }

  const result =
    await fixtureClient.query<{
      startAt:
        Date;
    }>(
      `
        SELECT
          date_bin(
            INTERVAL '15 minutes',
            clock_timestamp()
              -
              (
                $1::int
                *
                INTERVAL '1 minute'
              ),
            TIMESTAMPTZ
              '2000-01-01 00:00:00+00'
          )
            AS "startAt"
      `,
      [
        minimumMinutesAgo,
      ],
    );

  const startAt =
    result.rows[0]
      ?.startAt;

  if (
    !startAt
  ) {
    throw new Error(
      "Failed to calculate past test slot.",
    );
  }

  return startAt;
}

async function insertSession(
  input: {
    id:
      string;

    teacherProfileId?:
      string;

    studentUserId?:
      string;

    startAt:
      Date;

    status?:
      SessionStatus;
  },
): Promise<void> {
  if (
    !fixtureClient
  ) {
    throw new Error(
      "Fixture client is unavailable.",
    );
  }

  const endAt =
    new Date(
      input.startAt.getTime() +
      15 *
        60_000,
    );

  await fixtureClient.query(
    `
      INSERT INTO
        "speaking_session" (
          "id",
          "teacherProfileId",
          "studentUserId",
          "startAt",
          "endAt",
          "status",
          "bookingIdempotencyKey",
          "createdAt",
          "updatedAt"
        )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::"SpeakingSessionStatus",
        $7,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [
      input.id,

      input.teacherProfileId ??
        IDS.teacherProfileA,

      input.studentUserId ??
        IDS.studentA,

      input.startAt,
      endAt,

      input.status ??
        "SCHEDULED",

      `${input.id}_booking_key`,
    ],
  );
}

async function readSessionStatus(
  sessionId:
    string,
): Promise<string | null> {
  if (
    !fixtureClient
  ) {
    throw new Error(
      "Fixture client is unavailable.",
    );
  }

  const result =
    await fixtureClient.query<{
      status:
        string;
    }>(
      `
        SELECT
          "status"::text
            AS "status"
        FROM
          "speaking_session"
        WHERE
          "id" = $1
      `,
      [
        sessionId,
      ],
    );

  return (
    result.rows[0]
      ?.status ??
    null
  );
}

async function readCancellation(
  sessionId:
    string,
): Promise<CancellationRow | null> {
  if (
    !fixtureClient
  ) {
    throw new Error(
      "Fixture client is unavailable.",
    );
  }

  const result =
    await fixtureClient.query<CancellationRow>(
      `
        SELECT
          "id",
          "actorType"::text
            AS "actorType",
          "actorUserId",
          "reason",
          "cancelledAt"
        FROM
          "speaking_session_cancellation"
        WHERE
          "sessionId" = $1
      `,
      [
        sessionId,
      ],
    );

  return (
    result.rows[0] ??
    null
  );
}

async function countCancellations(
  sessionId:
    string,
): Promise<number> {
  if (
    !fixtureClient
  ) {
    throw new Error(
      "Fixture client is unavailable.",
    );
  }

  const result =
    await fixtureClient.query<{
      count:
        number;
    }>(
      `
        SELECT
          COUNT(*)::int
            AS "count"
        FROM
          "speaking_session_cancellation"
        WHERE
          "sessionId" = $1
      `,
      [
        sessionId,
      ],
    );

  return (
    result.rows[0]
      ?.count ??
    0
  );
}

describe.sequential(
  "Wave 2 speaking-session cancellation service",
  () => {
    beforeAll(
      async () => {
        fixtureClient =
          new Client({
            connectionString:
              testDatabaseUrl,

            application_name:
              "takineo-session-cancellation-service-test",
          });

        await fixtureClient.connect();

        await seedActors();

        applicationPrisma =
          createTestPrismaClient();

        /*
         * Keep the integration pattern identical
         * to the existing booking-service suite:
         * production imports prisma globally,
         * while this suite injects PrismaPg
         * against the isolated local PostgreSQL
         * database.
         */
        vi.resetModules();

        vi.doMock(
          "@/lib/db/prisma",
          () => ({
            prisma:
              applicationPrisma,
          }),
        );

        /*
         * Error constructors must come from the
         * same post-reset module graph as the
         * service for instanceof to be reliable.
         */
        const errors =
          await import(
            "@/lib/errors/session-cancellation-errors"
          );

        SessionCancellationCutoffError =
          errors
            .SessionCancellationCutoffError;

        SessionCancellationForbiddenError =
          errors
            .SessionCancellationForbiddenError;

        SessionCancellationStateError =
          errors
            .SessionCancellationStateError;

        SessionCancellationTargetNotFoundError =
          errors
            .SessionCancellationTargetNotFoundError;

        const service =
          await import(
            "@/lib/services/session-cancellation.service"
          );

        cancelSpeakingSessionAsStudent =
          service
            .cancelSpeakingSessionAsStudent;

        cancelSpeakingSessionAsTeacher =
          service
            .cancelSpeakingSessionAsTeacher;

        cancelSpeakingSessionAsAdmin =
          service
            .cancelSpeakingSessionAsAdmin;
      },
    );

    afterAll(
    async () => {
        try {
        await revokeAdminFixtureAccess();
        } finally {
        try {
            if (
            applicationPrisma
            ) {
            await applicationPrisma
                .$disconnect();

            applicationPrisma =
                null;
            }
        } finally {
            try {
            if (
                fixtureClient
            ) {
                await fixtureClient.end();

                fixtureClient =
                null;
            }
            } finally {
            vi.doUnmock(
                "@/lib/db/prisma",
            );

            vi.resetModules();
            }
        }
        }
    },
    );
    test(
      "student cancellation persists one atomic cancellation history row",
      async () => {
        const sessionId =
          `${PREFIX}_student_success`;

        const startAt =
          await futureAlignedStart(
            180,
            0,
          );

        await insertSession({
          id:
            sessionId,

          startAt,
        });

        const result =
          await cancelSpeakingSessionAsStudent(
            IDS.studentA,
            {
              sessionId,

              reason:
                "Schedule changed",
            },
          );

        expect(
          result.alreadyCancelled,
        ).toBe(
          false,
        );

        expect(
          result.session.status,
        ).toBe(
          "CANCELLED",
        );

        expect(
          result.cancellation,
        ).toMatchObject({
          sessionId,

          actorType:
            "STUDENT",

          actorUserId:
            IDS.studentA,

          reason:
            "Schedule changed",
        });

        expect(
          await readSessionStatus(
            sessionId,
          ),
        ).toBe(
          "CANCELLED",
        );

        expect(
          await countCancellations(
            sessionId,
          ),
        ).toBe(
          1,
        );
      },
    );

    test(
      "student cancellation inside the 120-minute cutoff is rejected without partial state",
      async () => {
        const sessionId =
          `${PREFIX}_student_cutoff`;

        /*
         * This resolves to roughly 60-75 minutes
         * ahead and therefore remains safely
         * inside the 120-minute student cutoff.
         */
        const startAt =
          await futureAlignedStart(
            60,
            0,
          );

        await insertSession({
          id:
            sessionId,

          startAt,
        });

        await expect(
          cancelSpeakingSessionAsStudent(
            IDS.studentA,
            {
              sessionId,
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionCancellationCutoffError,
        );

        expect(
          await readSessionStatus(
            sessionId,
          ),
        ).toBe(
          "SCHEDULED",
        );

        expect(
          await countCancellations(
            sessionId,
          ),
        ).toBe(
          0,
        );
      },
    );

    test(
      "teacher may cancel inside the student cutoff",
      async () => {
        const sessionId =
          `${PREFIX}_teacher_late`;

        const startAt =
          await futureAlignedStart(
            60,
            1,
          );

        await insertSession({
          id:
            sessionId,

          startAt,
        });

        const result =
          await cancelSpeakingSessionAsTeacher(
            IDS.teacherA,
            {
              sessionId,

              reason:
                "Unexpected technical issue",
            },
          );

        expect(
          result.session.status,
        ).toBe(
          "CANCELLED",
        );

        expect(
          result.cancellation,
        ).toMatchObject({
          actorType:
            "TEACHER",

          actorUserId:
            IDS.teacherA,

          reason:
            "Unexpected technical issue",
        });

        expect(
          await countCancellations(
            sessionId,
          ),
        ).toBe(
          1,
        );
      },
    );

    test(
      "teacher cannot cancel after the session has started",
      async () => {
        const sessionId =
          `${PREFIX}_teacher_started`;

        const startAt =
          await pastAlignedStart(
            30,
          );

        await insertSession({
          id:
            sessionId,

          startAt,
        });

        await expect(
          cancelSpeakingSessionAsTeacher(
            IDS.teacherA,
            {
              sessionId,

              reason:
                "Technical issue",
            },
          ),
        ).rejects.toMatchObject({
          name:
            "SessionCancellationStateError",

          state:
            "STARTED",
        });

        expect(
          await readSessionStatus(
            sessionId,
          ),
        ).toBe(
          "SCHEDULED",
        );

        expect(
          await countCancellations(
            sessionId,
          ),
        ).toBe(
          0,
        );
      },
    );

    test(
      "COMPLETED session cannot be cancelled",
      async () => {
        const sessionId =
          `${PREFIX}_completed`;

        const startAt =
          await futureAlignedStart(
            180,
            1,
          );

        await insertSession({
          id:
            sessionId,

          startAt,

          status:
            "COMPLETED",
        });

        await expect(
          cancelSpeakingSessionAsStudent(
            IDS.studentA,
            {
              sessionId,
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionCancellationStateError,
        );

        expect(
          await readSessionStatus(
            sessionId,
          ),
        ).toBe(
          "COMPLETED",
        );

        expect(
          await countCancellations(
            sessionId,
          ),
        ).toBe(
          0,
        );
      },
    );

    test(
      "REVIEWER cannot administratively cancel a session",
      async () => {
        const sessionId =
          `${PREFIX}_reviewer_denied`;

        const startAt =
          await futureAlignedStart(
            180,
            2,
          );

        await insertSession({
          id:
            sessionId,

          startAt,
        });

        await expect(
          cancelSpeakingSessionAsAdmin(
            IDS.reviewer,
            {
              sessionId,

              reason:
                "Administrative intervention",
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionCancellationForbiddenError,
        );

        expect(
          await readSessionStatus(
            sessionId,
          ),
        ).toBe(
          "SCHEDULED",
        );

        expect(
          await countCancellations(
            sessionId,
          ),
        ).toBe(
          0,
        );
      },
    );

    test(
      "SUPER_ADMIN can administratively cancel a session",
      async () => {
        const sessionId =
          `${PREFIX}_super_admin`;

        const startAt =
          await futureAlignedStart(
            180,
            3,
          );

        await insertSession({
          id:
            sessionId,

          startAt,
        });

        const result =
          await cancelSpeakingSessionAsAdmin(
            IDS.superAdmin,
            {
              sessionId,

              reason:
                "Administrative intervention",
            },
          );

        expect(
          result.session.status,
        ).toBe(
          "CANCELLED",
        );

        expect(
          result.cancellation,
        ).toMatchObject({
          actorType:
            "ADMIN",

          actorUserId:
            IDS.superAdmin,

          reason:
            "Administrative intervention",
        });
      },
    );

    test(
      "unrelated student receives not-found semantics and cannot alter the session",
      async () => {
        const sessionId =
          `${PREFIX}_unrelated_student`;

        const startAt =
          await futureAlignedStart(
            180,
            4,
          );

        await insertSession({
          id:
            sessionId,

          startAt,

          studentUserId:
            IDS.studentA,
        });

        await expect(
          cancelSpeakingSessionAsStudent(
            IDS.studentB,
            {
              sessionId,
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionCancellationTargetNotFoundError,
        );

        expect(
          await readSessionStatus(
            sessionId,
          ),
        ).toBe(
          "SCHEDULED",
        );

        expect(
          await countCancellations(
            sessionId,
          ),
        ).toBe(
          0,
        );
      },
    );

    test(
      "repeated cross-actor cancellation returns the original immutable attribution",
      async () => {
        const sessionId =
          `${PREFIX}_cross_actor_idempotent`;

        const startAt =
          await futureAlignedStart(
            180,
            5,
          );

        await insertSession({
          id:
            sessionId,

          startAt,
        });

        const first =
          await cancelSpeakingSessionAsTeacher(
            IDS.teacherA,
            {
              sessionId,

              reason:
                "Teacher emergency",
            },
          );

        const second =
          await cancelSpeakingSessionAsStudent(
            IDS.studentA,
            {
              sessionId,

              reason:
                "Student retry reason",
            },
          );

        expect(
          first.alreadyCancelled,
        ).toBe(
          false,
        );

        expect(
          second.alreadyCancelled,
        ).toBe(
          true,
        );

        expect(
          second.cancellation.id,
        ).toBe(
          first.cancellation.id,
        );

        expect(
          second.cancellation,
        ).toMatchObject({
          actorType:
            "TEACHER",

          actorUserId:
            IDS.teacherA,

          reason:
            "Teacher emergency",
        });

        expect(
          await countCancellations(
            sessionId,
          ),
        ).toBe(
          1,
        );
      },
    );

    test(
      "two simultaneous student cancellations converge on one durable history row",
      async () => {
        const sessionId =
          `${PREFIX}_student_race`;

        const startAt =
          await futureAlignedStart(
            180,
            6,
          );

        await insertSession({
          id:
            sessionId,

          startAt,
        });

        const [
          resultA,
          resultB,
        ] =
          await Promise.all([
            cancelSpeakingSessionAsStudent(
              IDS.studentA,
              {
                sessionId,

                reason:
                  "First request",
              },
            ),

            cancelSpeakingSessionAsStudent(
              IDS.studentA,
              {
                sessionId,

                reason:
                  "Second request",
              },
            ),
          ]);

        expect(
          [
            resultA
              .alreadyCancelled,

            resultB
              .alreadyCancelled,
          ].sort(),
        ).toEqual([
          false,
          true,
        ]);

        expect(
          resultA
            .cancellation
            .id,
        ).toBe(
          resultB
            .cancellation
            .id,
        );

        expect(
          await countCancellations(
            sessionId,
          ),
        ).toBe(
          1,
        );

        expect(
          await readSessionStatus(
            sessionId,
          ),
        ).toBe(
          "CANCELLED",
        );
      },
      20_000,
    );

    test(
      "simultaneous student and teacher cancellation preserve exactly one winning attribution",
      async () => {
        const sessionId =
          `${PREFIX}_cross_actor_race`;

        const startAt =
          await futureAlignedStart(
            180,
            7,
          );

        await insertSession({
          id:
            sessionId,

          startAt,
        });

        const [
          studentResult,
          teacherResult,
        ] =
          await Promise.all([
            cancelSpeakingSessionAsStudent(
              IDS.studentA,
              {
                sessionId,

                reason:
                  "Student request",
              },
            ),

            cancelSpeakingSessionAsTeacher(
              IDS.teacherA,
              {
                sessionId,

                reason:
                  "Teacher request",
              },
            ),
          ]);

        expect(
          studentResult
            .cancellation
            .id,
        ).toBe(
          teacherResult
            .cancellation
            .id,
        );

        expect(
          [
            studentResult
              .alreadyCancelled,

            teacherResult
              .alreadyCancelled,
          ].sort(),
        ).toEqual([
          false,
          true,
        ]);

        const durable =
          await readCancellation(
            sessionId,
          );

        expect(
          durable,
        ).not.toBeNull();

        expect(
          [
            "STUDENT",
            "TEACHER",
          ],
        ).toContain(
          durable
            ?.actorType,
        );

        expect(
          await countCancellations(
            sessionId,
          ),
        ).toBe(
          1,
        );
      },
      20_000,
    );

    test(
      "cancellation releases the teacher slot for a new session",
      async () => {
        const originalSessionId =
          `${PREFIX}_release_original`;

        const replacementSessionId =
          `${PREFIX}_release_replacement`;

        const startAt =
          await futureAlignedStart(
            180,
            8,
          );

        await insertSession({
          id:
            originalSessionId,

          startAt,

          teacherProfileId:
            IDS.teacherProfileA,

          studentUserId:
            IDS.studentA,
        });

        await cancelSpeakingSessionAsStudent(
          IDS.studentA,
          {
            sessionId:
              originalSessionId,
          },
        );

        /*
         * If the service really changed the
         * original row to CANCELLED, the partial
         * active-slot uniqueness constraint must
         * allow this replacement.
         */
        await insertSession({
          id:
            replacementSessionId,

          startAt,

          teacherProfileId:
            IDS.teacherProfileA,

          studentUserId:
            IDS.studentB,
        });

        expect(
          await readSessionStatus(
            originalSessionId,
          ),
        ).toBe(
          "CANCELLED",
        );

        expect(
          await readSessionStatus(
            replacementSessionId,
          ),
        ).toBe(
          "SCHEDULED",
        );
      },
    );
  },
);
