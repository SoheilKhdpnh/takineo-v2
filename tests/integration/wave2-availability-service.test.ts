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
  getTestDatabaseUrl,
} from "@/tests/support/test-database-url";
import {
  createTestPrismaClient,
} from "@/tests/support/test-prisma-client";

const testDatabaseUrl =
  getTestDatabaseUrl();

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
      kind:
        "Error",

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

  if (
    reason !== null &&
    typeof reason ===
      "object"
  ) {
    const record =
      reason as Record<
        string,
        unknown
      >;

    const nestedError =
      record.error;

    return {
      kind:
        Object.getPrototypeOf(
          reason,
        )?.constructor?.name ??
        "Object",

      type:
        record.type,

      message:
        record.message,

      code:
        record.code,

      meta:
        record.meta,

      error:
        nestedError instanceof Error
          ? {
              name:
                nestedError.name,

              message:
                nestedError.message,

              stack:
                nestedError.stack,
            }
          : nestedError,

      cause:
        record.cause,
    };
  }

  return reason;
}

const IDS = {
  teacherUser:
    "it_wave2_availability_teacher_user",

  teacherProfile:
    "it_wave2_availability_teacher_profile",
} as const;

let fixtureClient:
  Client | null = null;

let replaceTeacherWeeklyAvailability:
  typeof import(
    "@/lib/services/teacher-availability.service"
  ).replaceTeacherWeeklyAvailability;

let applicationPrisma:
  typeof import(
    "@/lib/db/prisma"
  ).prisma;

async function cleanupAvailability() {
  if (!fixtureClient) {
    return;
  }

  await fixtureClient.query(
    `
      DELETE FROM
        "teacher_availability_exception"
      WHERE
        "teacherProfileId" = $1
    `,
    [
      IDS.teacherProfile,
    ],
  );

  await fixtureClient.query(
    `
      DELETE FROM
        "teacher_availability_rule"
      WHERE
        "teacherProfileId" = $1
    `,
    [
      IDS.teacherProfile,
    ],
  );
}

async function cleanupFixture() {
  if (!fixtureClient) {
    return;
  }

  await cleanupAvailability();

  await fixtureClient.query(
    `
      DELETE FROM "teacher_profile"
      WHERE "id" = $1
    `,
    [
      IDS.teacherProfile,
    ],
  );

  await fixtureClient.query(
    `
      DELETE FROM "user"
      WHERE "id" = $1
    `,
    [
      IDS.teacherUser,
    ],
  );
}

async function seedApprovedTeacher() {
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
      VALUES (
        $1,
        'Wave 2 Availability Teacher',
        'wave2-availability-teacher@example.test',
        true,
        'TEACHER',
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [
      IDS.teacherUser,
    ],
  );

  await fixtureClient.query(
    `
      INSERT INTO "teacher_profile" (
        "id",
        "userId",
        "profileCompletedAt",
        "applicationStatus",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        CURRENT_TIMESTAMP,
        'APPROVED',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [
      IDS.teacherProfile,
      IDS.teacherUser,
    ],
  );
}

type ScheduleSignature = Array<{
  weekday: string;
  startMinute: number;
  endMinute: number;
  isActive: boolean;
}>;

function normalizeSchedule(
  schedule:
    ScheduleSignature,
): ScheduleSignature {
  return [
    ...schedule,
  ].sort(
    (
      first,
      second,
    ) =>
      first.weekday.localeCompare(
        second.weekday,
      ) ||
      first.startMinute -
        second.startMinute ||
      first.endMinute -
        second.endMinute,
  );
}

async function readCurrentSchedule():
  Promise<ScheduleSignature> {
  if (!fixtureClient) {
    throw new Error(
      "Fixture client is unavailable.",
    );
  }

  const result =
    await fixtureClient.query<{
      weekday: string;
      startMinute: number;
      endMinute: number;
      isActive: boolean;
    }>(
      `
        SELECT
          "weekday"::text
            AS weekday,
          "startMinute",
          "endMinute",
          "isActive"
        FROM
          "teacher_availability_rule"
        WHERE
          "teacherProfileId" = $1
      `,
      [
        IDS.teacherProfile,
      ],
    );

  return normalizeSchedule(
    result.rows,
  );
}

describe.sequential(
  "Wave 2 teacher availability service concurrency",
  () => {
    beforeAll(async () => {
      fixtureClient =
        new Client({
          connectionString:
            testDatabaseUrl,

          application_name:
            "takineo-wave2-availability-service-test",
        });

      await fixtureClient.connect();

      const identity =
        await fixtureClient.query<{
          database_name: string;
          user_name: string;
          server_address: string;
          server_port: number;
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

      await seedApprovedTeacher();

      /*
       * Production uses PrismaNeon.
       *
       * Integration tests use PrismaPg against
       * the already-guarded local PostgreSQL
       * database.
       */
      applicationPrisma =
        createTestPrismaClient();

      /*
       * Prove that PrismaPg itself, an
       * interactive Serializable transaction,
       * and PostgreSQL transaction-scoped
       * advisory locking all work before
       * exercising the service.
       */
      const smokeCount =
        await applicationPrisma
          .user
          .count();

      expect(
        smokeCount,
      ).toBeGreaterThanOrEqual(
        0,
      );

      await applicationPrisma
        .$transaction(
          async (tx) => {
            /*
             * pg_advisory_xact_lock returns void,
             * so use $executeRaw rather than
             * $queryRaw.
             */
            await tx.$executeRaw`
              SELECT
                pg_advisory_xact_lock(
                  ${123456789}::bigint
                )
            `;

            return tx.user.count();
          },
          {
            isolationLevel:
              "Serializable",
          },
        );

      console.log(
        "Local PrismaPg Serializable/advisory-lock smoke passed.",
      );

      /*
       * Import the real availability service
       * only after replacing its Prisma module
       * dependency with the local PrismaPg
       * integration client.
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
          "@/lib/services/teacher-availability.service"
        );

      replaceTeacherWeeklyAvailability =
        serviceModule
          .replaceTeacherWeeklyAvailability;
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
      "simultaneous whole-schedule replacements never leave a merged schedule",
      async () => {
        /*
         * Repeat the race several times rather
         * than relying on one scheduler
         * interleaving.
         */
        for (
          let iteration = 0;
          iteration < 8;
          iteration += 1
        ) {
          const offset =
            iteration * 15;

          const scheduleA = {
            rules: [
              {
                weekday:
                  "SATURDAY" as const,

                startMinute:
                  540 + offset,

                endMinute:
                  600 + offset,

                isActive:
                  true,
              },

              {
                weekday:
                  "MONDAY" as const,

                startMinute:
                  720 + offset,

                endMinute:
                  780 + offset,

                isActive:
                  true,
              },
            ],
          };

          const scheduleB = {
            rules: [
              {
                weekday:
                  "SUNDAY" as const,

                startMinute:
                  900 + offset,

                endMinute:
                  960 + offset,

                isActive:
                  true,
              },

              {
                weekday:
                  "TUESDAY" as const,

                startMinute:
                  1080 + offset,

                endMinute:
                  1140 + offset,

                isActive:
                  true,
              },
            ],
          };

          const [
            resultA,
            resultB,
          ] =
            await Promise.allSettled([
              replaceTeacherWeeklyAvailability(
                IDS.teacherUser,
                scheduleA,
              ),

              replaceTeacherWeeklyAvailability(
                IDS.teacherUser,
                scheduleB,
              ),
            ]);

          /*
           * Keep detailed diagnostics until this
           * real concurrency test has passed.
           */
          if (
            resultA.status ===
            "rejected"
          ) {
            console.dir(
              {
                scheduleA:
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
                scheduleB:
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

          const current =
            await readCurrentSchedule();

          const expectedA =
            normalizeSchedule(
              scheduleA.rules,
            );

          const expectedB =
            normalizeSchedule(
              scheduleB.rules,
            );

          /*
           * Lock acquisition order is allowed to
           * determine which complete replacement
           * becomes the final state.
           *
           * A merged or partial schedule is never
           * acceptable.
           */
          expect(
            current.length,
          ).toBe(
            2,
          );

          const matchesA =
            JSON.stringify(
              current,
            ) ===
            JSON.stringify(
              expectedA,
            );

          const matchesB =
            JSON.stringify(
              current,
            ) ===
            JSON.stringify(
              expectedB,
            );

          expect(
            matchesA ||
              matchesB,
          ).toBe(
            true,
          );
        }
      },
      20_000,
    );

    test(
      "concurrent clear and replacement leave one complete request state",
      async () => {
        const replacement = {
          rules: [
            {
              weekday:
                "WEDNESDAY" as const,

              startMinute:
                600,

              endMinute:
                660,

              isActive:
                true,
            },

            {
              weekday:
                "THURSDAY" as const,

              startMinute:
                840,

              endMinute:
                900,

              isActive:
                true,
            },
          ],
        };

        const [
          clearResult,
          replaceResult,
        ] =
          await Promise.allSettled([
            replaceTeacherWeeklyAvailability(
              IDS.teacherUser,
              {
                rules: [],
              },
            ),

            replaceTeacherWeeklyAvailability(
              IDS.teacherUser,
              replacement,
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

        if (
          replaceResult.status ===
          "rejected"
        ) {
          console.dir(
            {
              replacement:
                describeRejection(
                  replaceResult.reason,
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

        expect(
          replaceResult.status,
        ).toBe(
          "fulfilled",
        );

        const current =
          await readCurrentSchedule();

        const expectedReplacement =
          normalizeSchedule(
            replacement.rules,
          );

        const isClear =
          current.length === 0;

        const isReplacement =
          JSON.stringify(
            current,
          ) ===
          JSON.stringify(
            expectedReplacement,
          );

        expect(
          isClear ||
            isReplacement,
        ).toBe(
          true,
        );
      },
      15_000,
    );
  },
);