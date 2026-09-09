import {
  afterAll,
  beforeAll,
  beforeEach,
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

const NOW =
  new Date(
    "2026-08-10T08:00:00.000Z",
  );

/*
 * 2026-08-15 09:00 Asia/Tehran.
 *
 * Iran is UTC+03:30 in the Wave 2
 * operational-time model.
 */
const SLOT_START_AT =
  "2026-08-15T05:30:00.000Z";

const IDS = {
  studentUserA:
    "it_wave2_booking_student_a",

  studentUserB:
    "it_wave2_booking_student_b",

  teacherUserA:
    "it_wave2_booking_teacher_a",

  teacherUserB:
    "it_wave2_booking_teacher_b",

  teacherProfileA:
    "it_wave2_booking_profile_a",

  teacherProfileB:
    "it_wave2_booking_profile_b",

  introVideoA:
    "it_wave2_booking_video_a",

  introVideoB:
    "it_wave2_booking_video_b",

  availabilityRuleA:
    "it_wave2_booking_rule_a",

  availabilityRuleB:
    "it_wave2_booking_rule_b",
} as const;

let fixtureClient:
  Client | null = null;

let applicationPrisma:
  ReturnType<
    typeof createTestPrismaClient
  > | null = null;

let createSpeakingSession:
  typeof import(
    "@/lib/services/booking.service"
  ).createSpeakingSession;

let replaceTeacherWeeklyAvailability:
  typeof import(
    "@/lib/services/teacher-availability.service"
  ).replaceTeacherWeeklyAvailability;

let BookingSlotUnavailableError:
  typeof import(
    "@/lib/errors/booking-errors"
  ).BookingSlotUnavailableError;

let BookingIdempotencyConflictError:
  typeof import(
    "@/lib/errors/booking-errors"
  ).BookingIdempotencyConflictError;

function describeRejection(
  reason: unknown,
): unknown {
  if (
    reason instanceof Error
  ) {
    const extended =
      reason as Error & {
        code?: unknown;
        meta?: unknown;
        cause?: unknown;
      };

    return {
      name:
        reason.name,

      message:
        reason.message,

      code:
        extended.code,

      meta:
        extended.meta,

      cause:
        extended.cause,

      stack:
        reason.stack,
    };
  }

  return reason;
}

async function cleanupSessions():
  Promise<void> {
  if (!fixtureClient) {
    return;
  }

  /*
   * Cancellation rows use ON DELETE RESTRICT
   * against SpeakingSession, so history must
   * be removed first in the disposable test DB.
   */
  await fixtureClient.query(
    `
      DELETE FROM
        "speaking_session_cancellation"
      WHERE
        "sessionId" IN (
          SELECT
            "id"
          FROM
            "speaking_session"
          WHERE
            "studentUserId" IN (
              $1,
              $2
            )
            OR
            "teacherProfileId" IN (
              $3,
              $4
            )
        )
    `,
    [
      IDS.studentUserA,
      IDS.studentUserB,
      IDS.teacherProfileA,
      IDS.teacherProfileB,
    ],
  );

  await fixtureClient.query(
    `
      DELETE FROM
        "speaking_session"
      WHERE
        "studentUserId" IN (
          $1,
          $2
        )
        OR
        "teacherProfileId" IN (
          $3,
          $4
        )
    `,
    [
      IDS.studentUserA,
      IDS.studentUserB,
      IDS.teacherProfileA,
      IDS.teacherProfileB,
    ],
  );
}

async function cleanupAvailability():
  Promise<void> {
  if (!fixtureClient) {
    return;
  }

  await fixtureClient.query(
    `
      DELETE FROM
        "teacher_availability_exception"
      WHERE
        "teacherProfileId" IN (
          $1,
          $2
        )
    `,
    [
      IDS.teacherProfileA,
      IDS.teacherProfileB,
    ],
  );

  await fixtureClient.query(
    `
      DELETE FROM
        "teacher_availability_rule"
      WHERE
        "teacherProfileId" IN (
          $1,
          $2
        )
    `,
    [
      IDS.teacherProfileA,
      IDS.teacherProfileB,
    ],
  );
}

async function cleanupFixture():
  Promise<void> {
  if (!fixtureClient) {
    return;
  }

  await cleanupSessions();

  await cleanupAvailability();

  await fixtureClient.query(
    `
      DELETE FROM
        "teacher_intro_video"
      WHERE
        "teacherProfileId" IN (
          $1,
          $2
        )
    `,
    [
      IDS.teacherProfileA,
      IDS.teacherProfileB,
    ],
  );

  await fixtureClient.query(
    `
      DELETE FROM
        "teacher_profile"
      WHERE
        "id" IN (
          $1,
          $2
        )
    `,
    [
      IDS.teacherProfileA,
      IDS.teacherProfileB,
    ],
  );

  await fixtureClient.query(
    `
      DELETE FROM
        "user"
      WHERE
        "id" IN (
          $1,
          $2,
          $3,
          $4
        )
    `,
    [
      IDS.studentUserA,
      IDS.studentUserB,
      IDS.teacherUserA,
      IDS.teacherUserB,
    ],
  );
}

async function seedUsersAndTeachers():
  Promise<void> {
  if (!fixtureClient) {
    throw new Error(
      "Fixture client is unavailable.",
    );
  }

  await fixtureClient.query(
    `
      INSERT INTO "user" (
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
          'Wave 2 Booking Student A',
          'wave2-booking-student-a@example.test',
          true,
          'STUDENT',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $2,
          'Wave 2 Booking Student B',
          'wave2-booking-student-b@example.test',
          true,
          'STUDENT',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $3,
          'Wave 2 Booking Teacher A',
          'wave2-booking-teacher-a@example.test',
          true,
          'TEACHER',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $4,
          'Wave 2 Booking Teacher B',
          'wave2-booking-teacher-b@example.test',
          true,
          'TEACHER',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
    `,
    [
      IDS.studentUserA,
      IDS.studentUserB,
      IDS.teacherUserA,
      IDS.teacherUserB,
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
      IDS.teacherUserA,
      IDS.teacherProfileB,
      IDS.teacherUserB,
    ],
  );

  /*
   * Public booking eligibility currently
   * requires an APPROVED intro-video state.
   *
   * Real Mux playback material is not needed
   * for this booking-domain integration test.
   */
  await fixtureClient.query(
    `
      INSERT INTO
        "teacher_intro_video" (
          "id",
          "teacherProfileId",
          "status",
          "durationSeconds",
          "createdAt",
          "updatedAt"
        )
      VALUES
        (
          $1,
          $2,
          'APPROVED',
          90,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $3,
          $4,
          'APPROVED',
          90,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
    `,
    [
      IDS.introVideoA,
      IDS.teacherProfileA,
      IDS.introVideoB,
      IDS.teacherProfileB,
    ],
  );
}

async function seedAvailability():
  Promise<void> {
  if (!fixtureClient) {
    throw new Error(
      "Fixture client is unavailable.",
    );
  }

  await cleanupAvailability();

  /*
   * 2026-08-15 is Saturday.
   *
   * Both teachers are available from
   * 09:00Ã¢â‚¬â€œ10:00 Tehran time.
   */
  await fixtureClient.query(
    `
      INSERT INTO
        "teacher_availability_rule" (
          "id",
          "teacherProfileId",
          "weekday",
          "startMinute",
          "endMinute",
          "isActive",
          "createdAt",
          "updatedAt"
        )
      VALUES
        (
          $1,
          $2,
          'SATURDAY',
          540,
          600,
          true,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $3,
          $4,
          'SATURDAY',
          540,
          600,
          true,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
    `,
    [
      IDS.availabilityRuleA,
      IDS.teacherProfileA,
      IDS.availabilityRuleB,
      IDS.teacherProfileB,
    ],
  );
}

type SessionRow = {
  id: string;

  teacherProfileId:
    string;

  studentUserId:
    string;

  startAt:
    Date;

  status:
    string;

  bookingIdempotencyKey:
    string;
};

async function readFixtureSessions():
  Promise<SessionRow[]> {
  if (!fixtureClient) {
    throw new Error(
      "Fixture client is unavailable.",
    );
  }

  const result =
    await fixtureClient
      .query<SessionRow>(
        `
          SELECT
            "id",
            "teacherProfileId",
            "studentUserId",
            "startAt",
            "status"::text
              AS "status",
            "bookingIdempotencyKey"
          FROM
            "speaking_session"
          WHERE
            "studentUserId" IN (
              $1,
              $2
            )
          ORDER BY
            "createdAt",
            "id"
        `,
        [
          IDS.studentUserA,
          IDS.studentUserB,
        ],
      );

  return result.rows;
}

describe.sequential(
  "Wave 2 booking service concurrency",
  () => {
    beforeAll(async () => {
      fixtureClient =
        new Client({
          connectionString:
            testDatabaseUrl,

          application_name:
            "takineo-wave2-booking-service-test",
        });

      await fixtureClient.connect();

      const identity =
        await fixtureClient
          .query<{
            database_name:
              string;

            user_name:
              string;

            server_address:
              string;

            server_port:
              number;
          }>(
            `
              SELECT
                current_database()::text
                  AS database_name,

                current_user::text
                  AS user_name,

                host(
                  inet_server_addr()
                )::text
                  AS server_address,

                inet_server_port()::int
                  AS server_port
            `,
          );

      expect(
        identity.rows[0],
      ).toEqual({
        database_name:
          "takineo_test",

        user_name:
          "takineo_test",

        server_address:
          "127.0.0.1",

        server_port:
          5432,
      });

      await cleanupFixture();

      await seedUsersAndTeachers();

      applicationPrisma =
        createTestPrismaClient();

      /*
       * Production uses PrismaNeon.
       *
       * This integration suite intentionally
       * injects PrismaPg so the real service
       * executes against the isolated local
       * PostgreSQL database.
       */
      vi.resetModules();

      vi.resetModules();

      vi.doMock(
        "@/lib/db/prisma",
        () => ({
            prisma:
            applicationPrisma,
        }),
    );

    /*
    * Error constructors must come from the same
    * post-reset module graph as booking.service.
    *
    * Otherwise instanceof compares constructors
    * from two different module instances.
    */
    const bookingErrors =
        await import(
            "@/lib/errors/booking-errors"
        );

    BookingSlotUnavailableError =
        bookingErrors
            .BookingSlotUnavailableError;

    BookingIdempotencyConflictError =
        bookingErrors
            .BookingIdempotencyConflictError;

    const bookingModule =
        await import(
            "@/lib/services/booking.service"
        );

      createSpeakingSession =
        bookingModule
          .createSpeakingSession;

      const availabilityModule =
        await import(
          "@/lib/services/teacher-availability.service"
        );

      replaceTeacherWeeklyAvailability =
        availabilityModule
          .replaceTeacherWeeklyAvailability;
    });

    beforeEach(async () => {
      await cleanupSessions();

      await seedAvailability();
    });

    afterAll(async () => {
      try {
        await cleanupFixture();
      } finally {
        if (
          applicationPrisma
        ) {
          await applicationPrisma
            .$disconnect();

          applicationPrisma =
            null;
        }

        if (
          fixtureClient
        ) {
          await fixtureClient.end();

          fixtureClient =
            null;
        }

        vi.doUnmock(
          "@/lib/db/prisma",
        );

        vi.resetModules();
      }
    });

    test(
      "two students racing for one teacher slot produce exactly one booking",
      async () => {
        const [
          resultA,
          resultB,
        ] =
          await Promise.allSettled([
            createSpeakingSession(
              IDS.studentUserA,
              {
                teacherProfileId:
                  IDS.teacherProfileA,

                startAt:
                  SLOT_START_AT,

                idempotencyKey:
                  "race-teacher-slot-student-a-0001",
              },
              {
                now:
                  NOW,
              },
            ),

            createSpeakingSession(
              IDS.studentUserB,
              {
                teacherProfileId:
                  IDS.teacherProfileA,

                startAt:
                  SLOT_START_AT,

                idempotencyKey:
                  "race-teacher-slot-student-b-0001",
              },
              {
                now:
                  NOW,
              },
            ),
          ]);

        const results = [
          resultA,
          resultB,
        ];

        const fulfilled =
          results.filter(
            (result) =>
              result.status ===
              "fulfilled",
          );

        const rejected =
          results.filter(
            (result) =>
              result.status ===
              "rejected",
          );

        expect(
          fulfilled,
        ).toHaveLength(
          1,
        );

        expect(
          rejected,
        ).toHaveLength(
          1,
        );

        const rejectedResult =
          rejected[0];

        if (
          rejectedResult
            ?.status ===
          "rejected"
        ) {
          expect(
            rejectedResult.reason,
          ).toBeInstanceOf(
            BookingSlotUnavailableError,
          );
        }

        const sessions =
          await readFixtureSessions();

        expect(
          sessions,
        ).toHaveLength(
          1,
        );

        expect(
          sessions[0],
        ).toMatchObject({
          teacherProfileId:
            IDS.teacherProfileA,

          status:
            "SCHEDULED",
        });

        expect(
          sessions[0]
            ?.startAt
            .toISOString(),
        ).toBe(
          SLOT_START_AT,
        );
      },
      20_000,
    );

    test(
      "one student racing for two teachers at the same time produces exactly one booking",
      async () => {
        const [
          resultA,
          resultB,
        ] =
          await Promise.allSettled([
            createSpeakingSession(
              IDS.studentUserA,
              {
                teacherProfileId:
                  IDS.teacherProfileA,

                startAt:
                  SLOT_START_AT,

                idempotencyKey:
                  "race-student-slot-teacher-a-0001",
              },
              {
                now:
                  NOW,
              },
            ),

            createSpeakingSession(
              IDS.studentUserA,
              {
                teacherProfileId:
                  IDS.teacherProfileB,

                startAt:
                  SLOT_START_AT,

                idempotencyKey:
                  "race-student-slot-teacher-b-0001",
              },
              {
                now:
                  NOW,
              },
            ),
          ]);

        const results = [
          resultA,
          resultB,
        ];

        const fulfilled =
          results.filter(
            (result) =>
              result.status ===
              "fulfilled",
          );

        const rejected =
          results.filter(
            (result) =>
              result.status ===
              "rejected",
          );

        expect(
          fulfilled,
        ).toHaveLength(
          1,
        );

        expect(
          rejected,
        ).toHaveLength(
          1,
        );

        const rejectedResult =
          rejected[0];

        if (
          rejectedResult
            ?.status ===
          "rejected"
        ) {
          expect(
            rejectedResult.reason,
          ).toBeInstanceOf(
            BookingSlotUnavailableError,
          );
        }

        const sessions =
          await readFixtureSessions();

        expect(
          sessions,
        ).toHaveLength(
          1,
        );

        expect(
          sessions[0]
            ?.studentUserId,
        ).toBe(
          IDS.studentUserA,
        );

        expect(
          [
            IDS.teacherProfileA,
            IDS.teacherProfileB,
          ],
        ).toContain(
          sessions[0]
            ?.teacherProfileId,
        );
      },
      20_000,
    );

    test(
      "identical concurrent idempotent requests return one durable session",
      async () => {
        const input = {
          teacherProfileId:
            IDS.teacherProfileA,

          startAt:
            SLOT_START_AT,

          idempotencyKey:
            "race-identical-idempotency-0001",
        };

        const [
          resultA,
          resultB,
        ] =
          await Promise.allSettled([
            createSpeakingSession(
              IDS.studentUserA,
              input,
              {
                now:
                  NOW,
              },
            ),

            createSpeakingSession(
              IDS.studentUserA,
              input,
              {
                now:
                  NOW,
              },
            ),
          ]);

        if (
          resultA.status ===
          "rejected"
        ) {
          console.dir(
            {
              identicalA:
                describeRejection(
                  resultA.reason,
                ),
            },
            {
              depth: 10,
            },
          );
        }

        if (
          resultB.status ===
          "rejected"
        ) {
          console.dir(
            {
              identicalB:
                describeRejection(
                  resultB.reason,
                ),
            },
            {
              depth: 10,
            },
          );
        }

        expect(
          resultA.status,
        ).toBe(
          "fulfilled",
        );

        expect(
          resultB.status,
        ).toBe(
          "fulfilled",
        );

        if (
          resultA.status ===
            "fulfilled" &&
          resultB.status ===
            "fulfilled"
        ) {
          expect(
            resultA.value.id,
          ).toBe(
            resultB.value.id,
          );
        }

        const sessions =
          await readFixtureSessions();

        expect(
          sessions,
        ).toHaveLength(
          1,
        );

        expect(
          sessions[0]
            ?.bookingIdempotencyKey,
        ).toBe(
          input.idempotencyKey,
        );
      },
      20_000,
    );

    test(
      "same idempotency key with different concurrent payloads yields one explicit conflict",
      async () => {
        const idempotencyKey =
          "race-conflicting-idempotency-0001";

        const [
          resultA,
          resultB,
        ] =
          await Promise.allSettled([
            createSpeakingSession(
              IDS.studentUserA,
              {
                teacherProfileId:
                  IDS.teacherProfileA,

                startAt:
                  SLOT_START_AT,

                idempotencyKey,
              },
              {
                now:
                  NOW,
              },
            ),

            createSpeakingSession(
              IDS.studentUserA,
              {
                teacherProfileId:
                  IDS.teacherProfileB,

                startAt:
                  SLOT_START_AT,

                idempotencyKey,
              },
              {
                now:
                  NOW,
              },
            ),
          ]);

        const results = [
          resultA,
          resultB,
        ];

        const fulfilled =
          results.filter(
            (result) =>
              result.status ===
              "fulfilled",
          );

        const rejected =
          results.filter(
            (result) =>
              result.status ===
              "rejected",
          );

        expect(
          fulfilled,
        ).toHaveLength(
          1,
        );

        expect(
          rejected,
        ).toHaveLength(
          1,
        );

        const rejectedResult =
          rejected[0];

        if (
          rejectedResult
            ?.status ===
          "rejected"
        ) {
          expect(
            rejectedResult.reason,
          ).toBeInstanceOf(
            BookingIdempotencyConflictError,
          );
        }

        const sessions =
          await readFixtureSessions();

        expect(
          sessions,
        ).toHaveLength(
          1,
        );

        expect(
          sessions[0]
            ?.bookingIdempotencyKey,
        ).toBe(
          idempotencyKey,
        );
      },
      20_000,
    );

    test(
      "availability clear racing with booking leaves only a valid serialized outcome",
      async () => {
        const [
          clearResult,
          bookingResult,
        ] =
          await Promise.allSettled([
            replaceTeacherWeeklyAvailability(
              IDS.teacherUserA,
              {
                rules: [],
              },
            ),

            createSpeakingSession(
              IDS.studentUserA,
              {
                teacherProfileId:
                  IDS.teacherProfileA,

                startAt:
                  SLOT_START_AT,

                idempotencyKey:
                  "race-availability-clear-booking-0001",
              },
              {
                now:
                  NOW,
              },
            ),
          ]);

        if (
          clearResult.status ===
          "rejected"
        ) {
          console.dir(
            {
              clear:
                describeRejection(
                  clearResult.reason,
                ),
            },
            {
              depth: 10,
            },
          );
        }

        expect(
          clearResult.status,
        ).toBe(
          "fulfilled",
        );

        const remainingRules =
          await fixtureClient
            ?.query<{
              count:
                string;
            }>(
              `
                SELECT
                  COUNT(*)::text
                    AS count
                FROM
                  "teacher_availability_rule"
                WHERE
                  "teacherProfileId" = $1
              `,
              [
                IDS.teacherProfileA,
              ],
            );

        expect(
          Number(
            remainingRules
              ?.rows[0]
              ?.count ??
              "-1",
          ),
        ).toBe(
          0,
        );

        const sessions =
          await readFixtureSessions();

        if (
          bookingResult.status ===
          "fulfilled"
        ) {
          /*
           * Booking acquired the shared teacher
           * lock first.
           *
           * The later availability clear must
           * not destroy an already-created
           * durable session.
           */
          expect(
            sessions,
          ).toHaveLength(
            1,
          );

          expect(
            sessions[0],
          ).toMatchObject({
            teacherProfileId:
              IDS.teacherProfileA,

            studentUserId:
              IDS.studentUserA,

            status:
              "SCHEDULED",
          });
        } else {
          /*
           * Availability clear acquired the
           * shared teacher lock first.
           *
           * Booking must observe the cleared
           * schedule and fail closed.
           */
          expect(
            bookingResult.reason,
          ).toBeInstanceOf(
            BookingSlotUnavailableError,
          );

          expect(
            sessions,
          ).toHaveLength(
            0,
          );
        }
      },
      20_000,
    );
  },
);
