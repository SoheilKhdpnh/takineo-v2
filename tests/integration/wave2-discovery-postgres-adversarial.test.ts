import {
  PrismaPg,
} from "@prisma/adapter-pg";
import {
  Client,
} from "pg";
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
  PrismaClient,
} from "@/lib/generated/prisma/client";
import {
  iranLocalDateMinuteToInstant,
} from "@/lib/time/iran-booking-time";
import {
  getTestDatabaseUrl,
} from "@/tests/support/test-database-url";

const connectionString =
  getTestDatabaseUrl();

const NOW =
  new Date(
    "2026-08-18T08:00:00.000Z",
  );

const RANGE = {
  fromDate:
    "2026-08-22",

  toDate:
    "2026-08-22",
};

const PREFIX =
  "zzzz_trackd_disc_int_";

const CURSOR_BEFORE_FIXTURES =
  `${PREFIX}profile_000`;

const IDS = {
  public1:
    `${PREFIX}profile_001_public`,

  public2:
    `${PREFIX}profile_002_public`,

  public3:
    `${PREFIX}profile_003_public`,

  public4:
    `${PREFIX}profile_004_public`,

  applicationSuspended:
    `${PREFIX}profile_005_application_suspended`,

  accountSuspended:
    `${PREFIX}profile_006_account_suspended`,

  incomplete:
    `${PREFIX}profile_007_incomplete`,

  videoPending:
    `${PREFIX}profile_008_video_pending`,

  historyStudent:
    `${PREFIX}student_history`,
} as const;

type QueryEvent = {
  query:
    string;

  params:
    string;

  duration:
    number;

  target:
    string;
};

let fixtureClient:
  Client | null =
    null;

let applicationPrisma:
  PrismaClient | null =
    null;

let observedQueries:
  QueryEvent[] = [];

let listPublicTeachers:
  typeof import(
    "@/lib/services/teacher-discovery.service"
  ).listPublicTeachers;

function fixture():
  Client {
  if (!fixtureClient) {
    throw new Error(
      "Track D discovery fixture client is unavailable.",
    );
  }

  return fixtureClient;
}

async function cleanup():
  Promise<void> {
  const client =
    fixture();

  await client.query(
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
            "id" LIKE $1
        )
    `,
    [
      `${PREFIX}%`,
    ],
  );

  await client.query(
    `
      DELETE FROM
        "speaking_session"
      WHERE
        "id" LIKE $1
    `,
    [
      `${PREFIX}%`,
    ],
  );

  await client.query(
    `
      DELETE FROM
        "teacher_availability_exception"
      WHERE
        "teacherProfileId" LIKE $1
    `,
    [
      `${PREFIX}%`,
    ],
  );

  await client.query(
    `
      DELETE FROM
        "teacher_availability_rule"
      WHERE
        "teacherProfileId" LIKE $1
    `,
    [
      `${PREFIX}%`,
    ],
  );

  await client.query(
    `
      DELETE FROM
        "teacher_intro_video"
      WHERE
        "teacherProfileId" LIKE $1
    `,
    [
      `${PREFIX}%`,
    ],
  );

  await client.query(
    `
      DELETE FROM
        "teacher_profile"
      WHERE
        "id" LIKE $1
    `,
    [
      `${PREFIX}%`,
    ],
  );

  await client.query(
    `
      DELETE FROM
        "user"
      WHERE
        "id" LIKE $1
    `,
    [
      `${PREFIX}%`,
    ],
  );
}

type TeacherSeed = {
  profileId:
    string;

  accountStatus?:
    "ACTIVE" |
    "SUSPENDED" |
    "DISABLED";

  applicationStatus?:
    "APPROVED" |
    "SUSPENDED" |
    "PENDING_REVIEW";

  completed?:
    boolean;

  videoStatus?:
    "APPROVED" |
    "READY_FOR_REVIEW" |
    "REJECTED";
};

async function seedTeacher(
  seed:
    TeacherSeed,
): Promise<void> {
  const client =
    fixture();

  const userId =
    seed.profileId.replace(
      "profile_",
      "user_",
    );

  const suffix =
    seed.profileId
      .slice(
        PREFIX.length,
      )
      .replace(
        /[^A-Za-z0-9_-]/g,
        "_",
      );

  await client.query(
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
        $2,
        $3,
        true,
        $4::"UserRole",
        $5::"AccountStatus",
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [
      userId,
      `Track D ${suffix}`,
      `${suffix}@track-d-discovery.test`,
      "TEACHER",
      seed.accountStatus ??
        "ACTIVE",
    ],
  );

  await client.query(
    `
      INSERT INTO
        "teacher_profile" (
          "id",
          "userId",
          "headline",
          "bio",
          "experienceYears",
          "nativeLanguage",
          "teachingLanguage",
          "timezone",
          "profileCompletedAt",
          "applicationStatus",
          "applicationReviewNote",
          "createdAt",
          "updatedAt"
        )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        7,
        $5::"NativeLanguage",
        'en',
        $6::"Timezone",
        $7,
        $8::"TeacherApplicationStatus",
        $9,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [
      seed.profileId,
      userId,
      `Track D ${suffix}`,
      "Track D integration fixture biography.",
      "fa",
      "Asia/Tehran",
      seed.completed ===
        false
        ? null
        : new Date(
            "2026-08-01T00:00:00.000Z",
          ),
      seed.applicationStatus ??
        "APPROVED",
      `PRIVATE REVIEW NOTE ${suffix}`,
    ],
  );

  await client.query(
    `
      INSERT INTO
        "teacher_intro_video" (
          "id",
          "teacherProfileId",
          "provider",
          "uploadId",
          "assetId",
          "reviewPlaybackId",
          "status",
          "createdAt",
          "updatedAt"
        )
      VALUES (
        $1,
        $2,
        'mux',
        $3,
        $4,
        $5,
        $6::"TeacherIntroVideoStatus",
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [
      `${PREFIX}video_${suffix}`,
      seed.profileId,
      `${PREFIX}upload_${suffix}`,
      `${PREFIX}asset_${suffix}`,
      `${PREFIX}review_playback_${suffix}`,
      seed.videoStatus ??
        "APPROVED",
    ],
  );

  await client.query(
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
      VALUES (
        $1,
        $2,
        $3::"Weekday",
        540,
        600,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [
      `${PREFIX}rule_${suffix}`,
      seed.profileId,
      "SATURDAY",
    ],
  );
}

async function seedFixtures():
  Promise<void> {
  await seedTeacher({
    profileId:
      IDS.public1,
  });

  await seedTeacher({
    profileId:
      IDS.public2,
  });

  await seedTeacher({
    profileId:
      IDS.public3,
  });

  await seedTeacher({
    profileId:
      IDS.public4,
  });

  await seedTeacher({
    profileId:
      IDS.applicationSuspended,

    applicationStatus:
      "SUSPENDED",
  });

  await seedTeacher({
    profileId:
      IDS.accountSuspended,

    accountStatus:
      "SUSPENDED",
  });

  await seedTeacher({
    profileId:
      IDS.incomplete,

    completed:
      false,
  });

  await seedTeacher({
    profileId:
      IDS.videoPending,

    videoStatus:
      "READY_FOR_REVIEW",
  });
}

async function seedHistoricalSessions(
  count:
    number,
): Promise<void> {
  const client =
    fixture();

  await client.query(
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
        'Track D history student',
        'track-d-history-student@example.test',
        true,
        'STUDENT'::"UserRole",
        'ACTIVE'::"AccountStatus",
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [
      IDS.historyStudent,
    ],
  );

  await client.query(
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
      SELECT
        $1 ||
          lpad(
            series::text,
            6,
            '0'
          ),

        $2,

        $3,

        TIMESTAMPTZ
          '2020-01-01 00:00:00+00' +
          (
            series *
            INTERVAL '15 minutes'
          ),

        TIMESTAMPTZ
          '2020-01-01 00:15:00+00' +
          (
            series *
            INTERVAL '15 minutes'
          ),

        'COMPLETED'::"SpeakingSessionStatus",

        'track-d-history-' ||
          lpad(
            series::text,
            6,
            '0'
          ),

        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM
        generate_series(
          1,
          $4::int
        )
        AS series
    `,
    [
      `${PREFIX}session_history_`,
      IDS.public1,
      IDS.historyStudent,
      count,
    ],
  );

  await client.query(
    `
      ANALYZE "speaking_session"
    `,
  );
}

function clearObservedQueries():
  void {
  observedQueries = [];
}

function discoveryQueryEvents():
  QueryEvent[] {
  return observedQueries.filter(
    (
      event,
    ) =>
      /^\s*SELECT\b/i.test(
        event.query,
      ),
  );
}

function availabilityQueryEvents():
  QueryEvent[] {
  return discoveryQueryEvents()
    .filter(
      (
        event,
      ) =>
        /teacher_availability_rule|teacher_availability_exception|speaking_session/i.test(
          event.query,
        ),
    );
}

function hasPositiveSqlOffset(
  event:
    QueryEvent,
): boolean {
  const literal =
    event.query.match(
      /\bOFFSET\s+(\d+)\b/i,
    );

  if (
    literal
  ) {
    return Number(
      literal[1],
    ) >
      0;
  }

  const parameterized =
    event.query.match(
      /\bOFFSET\s+\$(\d+)\b/i,
    );

  if (
    !parameterized
  ) {
    return false;
  }

  const rawParams:
    unknown =
      JSON.parse(
        event.params,
      );

  if (
    !Array.isArray(
      rawParams,
    )
  ) {
    throw new Error(
      "Prisma query event params were not an array while checking OFFSET.",
    );
  }

  const position =
    Number(
      parameterized[1],
    ) -
    1;

  const value =
    rawParams[
      position
    ];

  if (
    typeof value ===
      "number"
  ) {
    return value >
      0;
  }

  if (
    typeof value ===
      "string"
  ) {
    return Number(
      value,
    ) >
      0;
  }

  throw new Error(
    `Unable to resolve Prisma OFFSET parameter at position ${position + 1}.`,
  );
}

describe.sequential(
  "Track D M3 real PostgreSQL discovery adversarial verification",
  () => {
    beforeAll(
      async () => {
        fixtureClient =
          new Client({
            connectionString,

            application_name:
              "takineo-track-d-discovery-postgres",
          });

        await fixtureClient
          .connect();

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

        await cleanup();

        const adapter =
          new PrismaPg({
            connectionString,

            options:
              "-c timezone=UTC",
          });

        applicationPrisma =
          new PrismaClient({
            adapter,

            log: [
              {
                emit:
                  "event",

                level:
                  "query",
              },
            ],
          });

        /*
         * Prisma's generated $on() type depends on the constructor log
         * configuration. applicationPrisma is stored as the broad
         * PrismaClient type for teardown/mocking, which erases that generic
         * and makes TypeScript infer the event type as never.
         *
         * Keep this cast local to Track D instrumentation rather than
         * widening production Prisma types.
         */
        const queryEventClient =
          applicationPrisma as unknown as {
            $on(
              eventType:
                "query",
              callback:
                (
                  event:
                    QueryEvent,
                ) => void,
            ): void;
          };

        queryEventClient.$on(
          "query",
          (
            event,
          ) => {
            observedQueries.push({
              query:
                event.query,

              params:
                event.params,

              duration:
                event.duration,

              target:
                event.target,
            });
          },
        );

        vi.resetModules();

        vi.doMock(
          "@/lib/db/prisma",
          () => ({
            prisma:
              applicationPrisma,
          }),
        );

        ({
          listPublicTeachers,
        } =
          await import(
            "@/lib/services/teacher-discovery.service"
          ));
      },
    );

    beforeEach(
      async () => {
        await cleanup();

        await seedFixtures();

        clearObservedQueries();
      },
    );

    afterAll(
      async () => {
        try {
          await cleanup();
        }
        finally {
          try {
            await applicationPrisma
              ?.$disconnect();

            applicationPrisma =
              null;
          }
          finally {
            try {
              await fixtureClient
                ?.end();

              fixtureClient =
                null;
            }
            finally {
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
      "real PostgreSQL eligibility returns only public teachers and the DTO never exposes review/account/provider-private data",
      async () => {
        const result =
          await listPublicTeachers(
            {
              cursor:
                CURSOR_BEFORE_FIXTURES,

              limit:
                20,

              ...RANGE,
            },
            {
              now:
                NOW,
            },
          );

        expect(
          result.teachers.map(
            (
              teacher,
            ) =>
              teacher.teacherProfileId,
          ),
        ).toEqual([
          IDS.public1,
          IDS.public2,
          IDS.public3,
          IDS.public4,
        ]);

        const serialized =
          JSON.stringify(
            result,
          );

        for (
          const forbidden
          of [
            "applicationStatus",
            "applicationReviewNote",
            "applicationSubmittedAt",
            "applicationReviewedAt",
            "reviewCycle",
            "submittedVideo",
            "uploadId",
            "assetId",
            "reviewPlaybackId",
            "accountStatus",
            "@track-d-discovery.test",
            "PRIVATE REVIEW NOTE",
          ]
        ) {
          expect(
            serialized,
          ).not.toContain(
            forbidden,
          );
        }

        expect(
          result.teachers.every(
            (
              teacher,
            ) =>
              teacher.nextAvailableAt
                ?.toISOString() ===
                "2026-08-22T05:30:00.000Z",
          ),
        ).toBe(
          true,
        );
      },
    );

    test(
      "keyset pagination survives the prior cursor teacher becoming non-public between pages",
      async () => {
        const firstPage =
          await listPublicTeachers(
            {
              cursor:
                CURSOR_BEFORE_FIXTURES,

              limit:
                1,

              ...RANGE,
            },
            {
              now:
                NOW,
            },
          );

        expect(
          firstPage.teachers.map(
            (
              teacher,
            ) =>
              teacher.teacherProfileId,
          ),
        ).toEqual([
          IDS.public1,
        ]);

        expect(
          firstPage.nextCursor,
        ).toBe(
          IDS.public1,
        );

        await fixture()
          .query(
            `
              UPDATE
                "teacher_profile"
              SET
                "applicationStatus" =
                  'SUSPENDED'::"TeacherApplicationStatus",
                "updatedAt" =
                  CURRENT_TIMESTAMP
              WHERE
                "id" = $1
            `,
            [
              IDS.public1,
            ],
          );

        const secondPage =
          await listPublicTeachers(
            {
              cursor:
                firstPage.nextCursor ??
                undefined,

              limit:
                1,

              ...RANGE,
            },
            {
              now:
                NOW,
            },
          );

        expect(
          secondPage.teachers.map(
            (
              teacher,
            ) =>
              teacher.teacherProfileId,
          ),
        ).toEqual([
          IDS.public2,
        ]);

        expect(
          secondPage.nextCursor,
        ).toBe(
          IDS.public2,
        );
      },
    );

    test(
      "real driver query count stays constant as the requested public page grows and the lookahead row never enters availability reads",
      async () => {
        clearObservedQueries();

        const one =
          await listPublicTeachers(
            {
              cursor:
                CURSOR_BEFORE_FIXTURES,

              limit:
                1,

              ...RANGE,
            },
            {
              now:
                NOW,
            },
          );

        expect(
          one.teachers,
        ).toHaveLength(
          1,
        );

        const smallEvents =
          discoveryQueryEvents();

        const smallCount =
          smallEvents.length;

        const batchEvents =
          availabilityQueryEvents();

        expect(
          batchEvents,
        ).toHaveLength(
          3,
        );

        for (
          const event
          of batchEvents
        ) {
          expect(
            event.params,
          ).toContain(
            IDS.public1,
          );

          expect(
            event.params,
          ).not.toContain(
            IDS.public2,
          );
        }

        expect(
          smallEvents.some(
            hasPositiveSqlOffset,
          ),
        ).toBe(
          false,
        );

        clearObservedQueries();

        const four =
          await listPublicTeachers(
            {
              cursor:
                CURSOR_BEFORE_FIXTURES,

              limit:
                4,

              ...RANGE,
            },
            {
              now:
                NOW,
            },
          );

        expect(
          four.teachers,
        ).toHaveLength(
          4,
        );

        const largeCount =
          discoveryQueryEvents()
            .length;

        expect(
          largeCount,
        ).toBe(
          smallCount,
        );
      },
    );

    test(
      "large historical session volume outside the Tehran window remains irrelevant to next availability and the emitted session query carries both date bounds",
      async () => {
        await seedHistoricalSessions(
          2_000,
        );

        clearObservedQueries();

        const result =
          await listPublicTeachers(
            {
              cursor:
                CURSOR_BEFORE_FIXTURES,

              limit:
                1,

              ...RANGE,
            },
            {
              now:
                NOW,
            },
          );

        expect(
          result.teachers[0]
            ?.teacherProfileId,
        ).toBe(
          IDS.public1,
        );

        expect(
          result.teachers[0]
            ?.nextAvailableAt
            ?.toISOString(),
        ).toBe(
          "2026-08-22T05:30:00.000Z",
        );

        const sessionEvent =
          discoveryQueryEvents()
            .find(
              (
                event,
              ) =>
                /speaking_session/i.test(
                  event.query,
                ),
            );

        expect(
          sessionEvent,
        ).toBeDefined();

        const rangeStart =
          iranLocalDateMinuteToInstant(
            RANGE.fromDate,
            0,
          ).toISOString();

        const rangeEndExclusive =
          iranLocalDateMinuteToInstant(
            RANGE.toDate,
            1440,
          ).toISOString();

        expect(
          sessionEvent?.params,
        ).toContain(
          rangeStart,
        );

        expect(
          sessionEvent?.params,
        ).toContain(
          rangeEndExclusive,
        );

        expect(
          sessionEvent?.params,
        ).toContain(
          IDS.public1,
        );
      },
    );
  },
);
