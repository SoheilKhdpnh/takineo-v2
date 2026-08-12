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

const AS_OF =
  new Date(
    "2026-08-20T10:00:00.000Z",
  );

const IDS = {
  studentUserA:
    "it_wave2_read_student_a",

  studentUserB:
    "it_wave2_read_student_b",

  studentProfileA:
    "it_wave2_read_student_profile_a",

  studentProfileB:
    "it_wave2_read_student_profile_b",

  teacherUserA:
    "it_wave2_read_teacher_a",

  teacherUserB:
    "it_wave2_read_teacher_b",

  teacherProfileA:
    "it_wave2_read_teacher_profile_a",

  teacherProfileB:
    "it_wave2_read_teacher_profile_b",

  staleScheduled:
    "it_wave2_read_stale_scheduled",

  exactBoundary:
    "it_wave2_read_exact_boundary",

  upcomingOne:
    "it_wave2_read_upcoming_1",

  upcomingTwo:
    "it_wave2_read_upcoming_2",

  upcomingThree:
    "it_wave2_read_upcoming_3",

  futureCompleted:
    "it_wave2_read_future_completed",

  otherStudentUpcoming:
    "it_wave2_read_other_student",
} as const;

let fixtureClient:
  Client | null =
    null;

let applicationPrisma:
  ReturnType<
    typeof createTestPrismaClient
  > | null =
    null;

let listSpeakingSessions:
  typeof import(
    "@/lib/services/speaking-session-read.service"
  ).listSpeakingSessions;

let getSpeakingSessionForViewer:
  typeof import(
    "@/lib/services/speaking-session-read.service"
  ).getSpeakingSessionForViewer;

let SessionReadTargetNotFoundError:
  typeof import(
    "@/lib/errors/session-read-errors"
  ).SessionReadTargetNotFoundError;

async function cleanupSessions():
  Promise<void> {
  if (
    !fixtureClient
  ) {
    return;
  }

  await fixtureClient.query(
    `
      DELETE FROM
        "speaking_session"
      WHERE
        "id" IN (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
    `,
    [
      IDS.staleScheduled,
      IDS.exactBoundary,
      IDS.upcomingOne,
      IDS.upcomingTwo,
      IDS.upcomingThree,
      IDS.futureCompleted,
      IDS.otherStudentUpcoming,
    ],
  );
}

async function cleanupActors():
  Promise<void> {
  if (
    !fixtureClient
  ) {
    return;
  }

  await fixtureClient.query(
    `
      DELETE FROM
        "student_profile"
      WHERE
        "id" IN (
          $1,
          $2
        )
    `,
    [
      IDS.studentProfileA,
      IDS.studentProfileB,
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

async function cleanupFixture():
  Promise<void> {
  await cleanupSessions();
  await cleanupActors();
}

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
      INSERT INTO "user" (
        "id",
        "name",
        "email",
        "emailVerified",
        "image",
        "role",
        "accountStatus",
        "createdAt",
        "updatedAt"
      )
      VALUES
        (
          $1,
          'Read Student A',
          'wave2-read-student-a@example.test',
          true,
          'student-a.png',
          'STUDENT',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $2,
          'Read Student B',
          'wave2-read-student-b@example.test',
          true,
          NULL,
          'STUDENT',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $3,
          'Read Teacher A',
          'wave2-read-teacher-a@example.test',
          true,
          'teacher-a.png',
          'TEACHER',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $4,
          'Read Teacher B',
          'wave2-read-teacher-b@example.test',
          true,
          NULL,
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
      INSERT INTO "student_profile" (
        "id",
        "userId",
        "createdAt",
        "updatedAt"
      )
      VALUES
        (
          $1,
          $2,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $3,
          $4,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
    `,
    [
      IDS.studentProfileA,
      IDS.studentUserA,
      IDS.studentProfileB,
      IDS.studentUserB,
    ],
  );

  await fixtureClient.query(
    `
      INSERT INTO "teacher_profile" (
        "id",
        "userId",
        "headline",
        "createdAt",
        "updatedAt"
      )
      VALUES
        (
          $1,
          $2,
          'Teacher A headline',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $3,
          $4,
          'Teacher B headline',
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
}

async function seedSessions():
  Promise<void> {
  if (
    !fixtureClient
  ) {
    throw new Error(
      "Fixture client is unavailable.",
    );
  }

  /*
   * Every session remains exactly 15 minutes
   * and starts on the quarter-hour grid.
   *
   * Relative to AS_OF = 10:00Z:
   *
   * 09:30-09:45 SCHEDULED -> history
   * 09:45-10:00 SCHEDULED -> history exactly at edge
   * 10:00-10:15 SCHEDULED -> upcoming
   * 10:15-10:30 SCHEDULED -> upcoming
   * 10:30-10:45 SCHEDULED -> upcoming
   * 11:00-11:15 COMPLETED -> history despite future time
   */
  await fixtureClient.query(
    `
      INSERT INTO "speaking_session" (
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
      VALUES
        (
          $1,
          $8,
          $10,
          '2026-08-20T09:30:00Z',
          '2026-08-20T09:45:00Z',
          'SCHEDULED',
          'read-stale',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $2,
          $9,
          $10,
          '2026-08-20T09:45:00Z',
          '2026-08-20T10:00:00Z',
          'SCHEDULED',
          'read-boundary',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $3,
          $8,
          $10,
          '2026-08-20T10:00:00Z',
          '2026-08-20T10:15:00Z',
          'SCHEDULED',
          'read-upcoming-1',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $4,
          $9,
          $10,
          '2026-08-20T10:15:00Z',
          '2026-08-20T10:30:00Z',
          'SCHEDULED',
          'read-upcoming-2',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $5,
          $8,
          $10,
          '2026-08-20T10:30:00Z',
          '2026-08-20T10:45:00Z',
          'SCHEDULED',
          'read-upcoming-3',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $6,
          $9,
          $10,
          '2026-08-20T11:00:00Z',
          '2026-08-20T11:15:00Z',
          'COMPLETED',
          'read-future-completed',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $7,
          $8,
          $11,
          '2026-08-20T10:45:00Z',
          '2026-08-20T11:00:00Z',
          'SCHEDULED',
          'read-other-student',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
    `,
    [
      IDS.staleScheduled,
      IDS.exactBoundary,
      IDS.upcomingOne,
      IDS.upcomingTwo,
      IDS.upcomingThree,
      IDS.futureCompleted,
      IDS.otherStudentUpcoming,
      IDS.teacherProfileA,
      IDS.teacherProfileB,
      IDS.studentUserA,
      IDS.studentUserB,
    ],
  );
}

describe.sequential(
  "Wave 2 speaking-session read service",
  () => {
    beforeAll(
      async () => {
        fixtureClient =
          new Client({
            connectionString:
              testDatabaseUrl,

            application_name:
              "takineo-wave2-session-read-test",
          });

        await fixtureClient.connect();

        const identity =
          await fixtureClient.query<{
            database_name:
              string;

            user_name:
              string;

            server_address:
              string;

            server_port:
              number;
          }>(`
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
          `);

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
        await seedActors();

        applicationPrisma =
          createTestPrismaClient();

        /*
         * Production uses its normal Prisma
         * singleton. This integration suite
         * injects PrismaPg pointed only at the
         * guarded disposable test database.
         */
        vi.resetModules();

        vi.doMock(
          "@/lib/db/prisma",
          () => ({
            prisma:
              applicationPrisma,
          }),
        );

        const serviceModule =
          await import(
            "@/lib/services/speaking-session-read.service"
          );

        listSpeakingSessions =
          serviceModule
            .listSpeakingSessions;

        getSpeakingSessionForViewer =
          serviceModule
            .getSpeakingSessionForViewer;

        const errorModule =
          await import(
            "@/lib/errors/session-read-errors"
          );

        SessionReadTargetNotFoundError =
          errorModule
            .SessionReadTargetNotFoundError;
      },
    );

    beforeEach(
      async () => {
        await cleanupSessions();
        await seedSessions();
      },
    );

    afterAll(
      async () => {
        try {
          await cleanupFixture();
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

            if (
              fixtureClient
            ) {
              await fixtureClient
                .end();

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
      },
    );

    test(
      "student listing never exposes another student's sessions",
      async () => {
        const result =
          await listSpeakingSessions(
            IDS.studentUserA,
            {
              bucket:
                "upcoming",

              limit:
                20,
            },
            {
              now:
                AS_OF,
            },
          );

        expect(
          result.items.map(
            (session) =>
              session.id,
          ),
        ).toEqual([
          IDS.upcomingOne,
          IDS.upcomingTwo,
          IDS.upcomingThree,
        ]);

        expect(
          result.items.map(
            (session) =>
              session.id,
          ),
        ).not.toContain(
          IDS.otherStudentUpcoming,
        );
      },
    );

    test(
      "teacher listing is scoped by teacherProfileId rather than student ownership",
      async () => {
        const result =
          await listSpeakingSessions(
            IDS.teacherUserA,
            {
              bucket:
                "upcoming",

              limit:
                20,
            },
            {
              now:
                AS_OF,
            },
          );

        expect(
          result.items.map(
            (session) =>
              session.id,
          ),
        ).toEqual([
          IDS.upcomingOne,
          IDS.upcomingThree,
          IDS.otherStudentUpcoming,
        ]);

        expect(
          result.items.every(
            (session) =>
              session
                .counterparty
                .type ===
              "STUDENT",
          ),
        ).toBe(
          true,
        );
      },
    );

    test(
      "history uses endAt at the exact boundary and does not wait for completion status",
      async () => {
        const result =
          await listSpeakingSessions(
            IDS.studentUserA,
            {
              bucket:
                "history",

              limit:
                20,
            },
            {
              now:
                AS_OF,
            },
          );

        expect(
          result.items.map(
            (session) =>
              session.id,
          ),
        ).toEqual([
          IDS.futureCompleted,
          IDS.exactBoundary,
          IDS.staleScheduled,
        ]);

        const boundary =
          result.items.find(
            (session) =>
              session.id ===
              IDS.exactBoundary,
          );

        const stale =
          result.items.find(
            (session) =>
              session.id ===
              IDS.staleScheduled,
          );

        expect(
          boundary?.status,
        ).toBe(
          "SCHEDULED",
        );

        expect(
          stale?.status,
        ).toBe(
          "SCHEDULED",
        );
      },
    );

    test(
      "terminal status puts a session in history even when endAt is still in the future",
      async () => {
        const history =
          await listSpeakingSessions(
            IDS.studentUserA,
            {
              bucket:
                "history",

              limit:
                20,
            },
            {
              now:
                AS_OF,
            },
          );

        expect(
          history.items[0],
        ).toMatchObject({
          id:
            IDS.futureCompleted,

          status:
            "COMPLETED",
        });

        expect(
          history.items[0]
            .endAt.getTime(),
        ).toBeGreaterThan(
          AS_OF.getTime(),
        );

        const upcoming =
          await listSpeakingSessions(
            IDS.studentUserA,
            {
              bucket:
                "upcoming",

              limit:
                20,
            },
            {
              now:
                AS_OF,
            },
          );

        expect(
          upcoming.items.map(
            (session) =>
              session.id,
          ),
        ).not.toContain(
          IDS.futureCompleted,
        );
      },
    );

    test(
      "upcoming pagination is ascending and produces no duplicates or skips",
      async () => {
        const collected:
          string[] = [];

        let cursor:
          string | undefined;

        do {
          const page =
            await listSpeakingSessions(
              IDS.studentUserA,
              {
                bucket:
                  "upcoming",

                limit:
                  1,

                ...(cursor
                  ? {
                      cursor,
                    }
                  : {}),
              },
              {
                now:
                  AS_OF,
              },
            );

          collected.push(
            ...page.items.map(
              (session) =>
                session.id,
            ),
          );

          cursor =
            page.nextCursor ??
            undefined;
        } while (
          cursor
        );

        expect(
          collected,
        ).toEqual([
          IDS.upcomingOne,
          IDS.upcomingTwo,
          IDS.upcomingThree,
        ]);

        expect(
          new Set(
            collected,
          ).size,
        ).toBe(
          collected.length,
        );
      },
    );

    test(
      "a later page preserves the first page asOf even after wall-clock time crosses session boundaries",
      async () => {
        const pageOne =
          await listSpeakingSessions(
            IDS.studentUserA,
            {
              bucket:
                "upcoming",

              limit:
                1,
            },
            {
              now:
                AS_OF,
            },
          );

        expect(
          pageOne.items.map(
            (session) =>
              session.id,
          ),
        ).toEqual([
          IDS.upcomingOne,
        ]);

        expect(
          pageOne.nextCursor,
        ).not.toBeNull();

        /*
         * At 10:40Z, upcomingTwo has already
         * ended at 10:30Z. It must nevertheless
         * remain in this pagination sequence
         * because page one pinned asOf=10:00Z.
         */
        const pageTwo =
          await listSpeakingSessions(
            IDS.studentUserA,
            {
              bucket:
                "upcoming",

              limit:
                1,

              cursor:
                pageOne.nextCursor!,
            },
            {
              now:
                new Date(
                  "2026-08-20T10:40:00.000Z",
                ),
            },
          );

        expect(
          pageTwo.items.map(
            (session) =>
              session.id,
          ),
        ).toEqual([
          IDS.upcomingTwo,
        ]);

        expect(
          pageTwo.items[0]
            .endAt.getTime(),
        ).toBeLessThan(
          new Date(
            "2026-08-20T10:40:00.000Z",
          ).getTime(),
        );
      },
    );

    test(
      "student detail exposes only the teacher counterparty projection",
      async () => {
        const result =
          await getSpeakingSessionForViewer(
            IDS.studentUserA,
            IDS.upcomingOne,
          );

        expect(
          result,
        ).toMatchObject({
          id:
            IDS.upcomingOne,

          counterparty: {
            type:
              "TEACHER",

            userId:
              IDS.teacherUserA,

            teacherProfileId:
              IDS.teacherProfileA,

            name:
              "Read Teacher A",

            image:
              "teacher-a.png",

            headline:
              "Teacher A headline",
          },

          cancellation:
            null,
        });

        expect(
          "studentUserId" in
            result,
        ).toBe(
          false,
        );
      },
    );

    test(
      "teacher detail exposes only the student counterparty projection",
      async () => {
        const result =
          await getSpeakingSessionForViewer(
            IDS.teacherUserA,
            IDS.otherStudentUpcoming,
          );

        expect(
          result.counterparty,
        ).toEqual({
          type:
            "STUDENT",

          userId:
            IDS.studentUserB,

          name:
            "Read Student B",

          image:
            null,
        });
      },
    );

    test(
      "nonexistent and unowned session details are indistinguishable",
      async () => {
        await expect(
          getSpeakingSessionForViewer(
            IDS.studentUserA,
            "it_wave2_read_missing",
          ),
        ).rejects.toBeInstanceOf(
          SessionReadTargetNotFoundError,
        );

        await expect(
          getSpeakingSessionForViewer(
            IDS.studentUserA,
            IDS.otherStudentUpcoming,
          ),
        ).rejects.toBeInstanceOf(
          SessionReadTargetNotFoundError,
        );
      },
    );
  },
);
