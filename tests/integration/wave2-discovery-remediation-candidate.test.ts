import {
  performance,
} from "node:perf_hooks";

import {
  PrismaPg,
} from "@prisma/adapter-pg";
import {
  Client,
} from "pg";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  PrismaClient,
} from "@/lib/generated/prisma/client";
import {
  getTestDatabaseUrl,
} from "@/tests/support/test-database-url";

const ALLOWED_SCALES =
  new Set([
    1_000,
    10_000,
  ]);

const scale =
  Number(
    process.env
      .TRACK_D_DISCOVERY_REMEDIATION_SCALE ??
      "1000",
  );

if (
  !Number.isInteger(
    scale,
  ) ||
  !ALLOWED_SCALES.has(
    scale,
  )
) {
  throw new Error(
    "TRACK_D_DISCOVERY_REMEDIATION_SCALE must be 1000 or 10000. Track D must not run 50000 for this closure.",
  );
}

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

const PAGE_SIZE =
  40;

const prefix =
  `zzzz_trackd_remediation_${String(
    scale,
  ).padStart(
    5,
    "0",
  )}_`;

const cursorBeforeFixtures =
  `${prefix}profile_000000`;

const firstPublicIndex =
  Math.floor(
    scale *
      0.9,
  ) +
  1;

function padded(
  value:
    number,
): string {
  return String(
    value,
  ).padStart(
    6,
    "0",
  );
}

function profileId(
  value:
    number,
): string {
  return `${prefix}profile_${padded(
    value,
  )}`;
}

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

type PlanNode =
  Record<
    string,
    unknown
  > & {
    Plans?:
      PlanNode[];
  };

type RelationScan = {
  relation:
    string | null;

  nodeType:
    string;

  indexName:
    string | null;

  actualRows:
    number;

  loops:
    number;

  rowsRemoved:
    number;

  estimatedRows:
    number;

  examinedRows:
    number;
};

type PlanReport = {
  surface:
    string;

  planningMs:
    number | null;

  executionMs:
    number | null;

  scans:
    RelationScan[];
};

let fixtureClient:
  Client | null =
    null;

let applicationPrisma:
  PrismaClient | null =
    null;

let listPublicTeachers:
  typeof import(
    "@/lib/services/teacher-discovery.service"
  ).listPublicTeachers;

let observedQueries:
  QueryEvent[] = [];

function fixture():
  Client {
  if (!fixtureClient) {
    throw new Error(
      "Track D remediation fixture client is unavailable.",
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
      `${prefix}%`,
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
      `${prefix}%`,
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
      `${prefix}%`,
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
      `${prefix}%`,
    ],
  );

  /*
   * Explicitly clean the remediation projection before parent rows.
   * This also proves the expected projection table is present.
   */
  await client.query(
    `
      DELETE FROM
        "public_teacher_discovery_eligibility"
      WHERE
        "teacherProfileId" LIKE $1
    `,
    [
      `${prefix}%`,
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
      `${prefix}%`,
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
      `${prefix}%`,
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
      `${prefix}%`,
    ],
  );
}

async function seedSyntheticDataset():
  Promise<void> {
  const client =
    fixture();

  await client.query(
    "BEGIN",
  );

  try {
    await client.query(
      `
        SET LOCAL
          synchronous_commit =
          off
      `,
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
        SELECT
          $1 ||
            'user_' ||
            lpad(
              series::text,
              6,
              '0'
            ),

          'Track D Remediation Teacher ' ||
            series::text,

          $1 ||
            'teacher_' ||
            series::text ||
            '@remediation.test',

          true,

          'TEACHER'::"UserRole",

          CASE
            WHEN
              series >
              floor(
                $2::numeric *
                0.9
              )
            THEN
              'ACTIVE'::"AccountStatus"
            ELSE
              'SUSPENDED'::"AccountStatus"
          END,

          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        FROM
          generate_series(
            1,
            $2::int
          )
          AS series
      `,
      [
        prefix,
        scale,
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
        SELECT
          $1 ||
            'profile_' ||
            lpad(
              series::text,
              6,
              '0'
            ),

          $1 ||
            'user_' ||
            lpad(
              series::text,
              6,
              '0'
            ),

          'Remediation teacher ' ||
            series::text,

          'Track D remediation synthetic discovery fixture.',

          5,

          'fa'::"NativeLanguage",

          'en',

          'Asia/Tehran'::"Timezone",

          TIMESTAMPTZ
            '2026-08-01 00:00:00+00',

          'APPROVED'::"TeacherApplicationStatus",

          'PRIVATE REMEDIATION REVIEW NOTE',

          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        FROM
          generate_series(
            1,
            $2::int
          )
          AS series
      `,
      [
        prefix,
        scale,
      ],
    );

    await client.query(
      `
        INSERT INTO
          "teacher_intro_video" (
            "id",
            "teacherProfileId",
            "provider",
            "status",
            "createdAt",
            "updatedAt"
          )
        SELECT
          $1 ||
            'video_' ||
            lpad(
              series::text,
              6,
              '0'
            ),

          $1 ||
            'profile_' ||
            lpad(
              series::text,
              6,
              '0'
            ),

          'mux',

          'APPROVED'::"TeacherIntroVideoStatus",

          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        FROM
          generate_series(
            1,
            $2::int
          )
          AS series
      `,
      [
        prefix,
        scale,
      ],
    );

    /*
     * Preserve the original Track D adversarial distribution exactly:
     * approximately first 90% of ordered teacher IDs are non-public;
     * approximately final 10% are public.
     *
     * The remediation read model materializes canonical public eligibility,
     * so the synthetic query-shape probe seeds projection membership for the
     * same final 10%. Synchronization correctness is a separate invariant;
     * this test measures the candidate read-path complexity independently.
     */
    await client.query(
      `
        INSERT INTO
          "public_teacher_discovery_eligibility" (
            "teacherProfileId"
          )
        SELECT
          $1 ||
            'profile_' ||
            lpad(
              series::text,
              6,
              '0'
            )
        FROM
          generate_series(
            1,
            $2::int
          )
          AS series
        WHERE
          series >
          floor(
            $2::numeric *
            0.9
          )
      `,
      [
        prefix,
        scale,
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
        SELECT
          $1 ||
            'rule_' ||
            lpad(
              series::text,
              6,
              '0'
            ),

          $1 ||
            'profile_' ||
            lpad(
              series::text,
              6,
              '0'
            ),

          'SATURDAY'::"Weekday",

          540,

          600,

          true,

          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        FROM
          generate_series(
            1,
            $2::int
          )
          AS series
      `,
      [
        prefix,
        scale,
      ],
    );

    await client.query(
      `
        INSERT INTO
          "teacher_availability_exception" (
            "id",
            "teacherProfileId",
            "date",
            "startMinute",
            "endMinute",
            "type",
            "note",
            "createdAt",
            "updatedAt"
          )
        SELECT
          $1 ||
            'exception_' ||
            lpad(
              series::text,
              6,
              '0'
            ),

          $1 ||
            'profile_' ||
            lpad(
              series::text,
              6,
              '0'
            ),

          DATE '2020-01-01',

          600,

          615,

          'AVAILABLE'::"AvailabilityExceptionType",

          'Historical remediation exception',

          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        FROM
          generate_series(
            1,
            $2::int
          )
          AS series
      `,
      [
        prefix,
        scale,
      ],
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
          'Track D remediation history student',
          $2,
          true,
          'STUDENT'::"UserRole",
          'ACTIVE'::"AccountStatus",
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `,
      [
        `${prefix}student_history`,
        `${prefix}student_history@remediation.test`,
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
            'session_' ||
            lpad(
              series::text,
              6,
              '0'
            ),

          $1 ||
            'profile_' ||
            lpad(
              series::text,
              6,
              '0'
            ),

          $1 ||
            'student_history',

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

          'remediation-history-' ||
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
            $2::int
          )
          AS series
      `,
      [
        prefix,
        scale,
      ],
    );

    await client.query(
      "COMMIT",
    );
  }
  catch (
    error
  ) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  }

  for (
    const table
    of [
      "user",
      "teacher_profile",
      "teacher_intro_video",
      "public_teacher_discovery_eligibility",
      "teacher_availability_rule",
      "teacher_availability_exception",
      "speaking_session",
    ]
  ) {
    await client.query(
      `ANALYZE "${table}"`,
    );
  }

  const projectionCount =
    await client.query<{
      count:
        string;
    }>(
      `
        SELECT
          count(*)::text
            AS count
        FROM
          "public_teacher_discovery_eligibility"
        WHERE
          "teacherProfileId" LIKE $1
      `,
      [
        `${prefix}%`,
      ],
    );

  expect(
    Number(
      projectionCount
        .rows[0]
        ?.count ??
        "0",
    ),
  ).toBe(
    scale -
      Math.floor(
        scale *
          0.9,
      ),
  );
}

function clearObservedQueries():
  void {
  observedQueries = [];
}

function selectEvents():
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

function decodePrismaParam(
  value:
    unknown,
): unknown {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      decodePrismaParam,
    );
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    const record =
      value as Record<
        string,
        unknown
      >;

    if (
      typeof record
        .prisma__type ===
        "string" &&
      "prisma__value"
        in record
    ) {
      const kind =
        record.prisma__type;

      const raw =
        record
          .prisma__value;

      if (
        kind ===
          "date" ||
        kind ===
          "bigint" ||
        kind ===
          "decimal"
      ) {
        return raw;
      }

      if (
        kind ===
          "bytes" &&
        typeof raw ===
          "string"
      ) {
        return Buffer.from(
          raw,
          "base64",
        );
      }

      return decodePrismaParam(
        raw,
      );
    }

    return Object.fromEntries(
      Object.entries(
        record,
      ).map(
        (
          [
            key,
            nested,
          ],
        ) => [
          key,
          decodePrismaParam(
            nested,
          ),
        ],
      ),
    );
  }

  return value;
}

function parseEventParams(
  event:
    QueryEvent,
): unknown[] {
  const parsed:
    unknown =
      JSON.parse(
        event.params,
      );

  if (
    !Array.isArray(
      parsed,
    )
  ) {
    throw new Error(
      "Prisma query event params were not an array.",
    );
  }

  return parsed.map(
    decodePrismaParam,
  );
}

function collectRelationScans(
  plan:
    PlanNode,
  output:
    RelationScan[] = [],
): RelationScan[] {
  const nodeType =
    typeof plan[
      "Node Type"
    ] ===
      "string"
      ? String(
          plan[
            "Node Type"
          ],
        )
      : "Unknown";

  const relation =
    typeof plan[
      "Relation Name"
    ] ===
      "string"
      ? String(
          plan[
            "Relation Name"
          ],
        )
      : null;

  const indexName =
    typeof plan[
      "Index Name"
    ] ===
      "string"
      ? String(
          plan[
            "Index Name"
          ],
        )
      : null;

  const actualRows =
    Number(
      plan[
        "Actual Rows"
      ] ??
        0,
    );

  const loops =
    Number(
      plan[
        "Actual Loops"
      ] ??
        1,
    );

  const rowsRemoved =
    Number(
      plan[
        "Rows Removed by Filter"
      ] ??
        0,
    ) +
    Number(
      plan[
        "Rows Removed by Index Recheck"
      ] ??
        0,
    );

  const estimatedRows =
    Number(
      plan[
        "Plan Rows"
      ] ??
        0,
    );

  if (
    relation !==
      null
  ) {
    output.push({
      relation,
      nodeType,
      indexName,
      actualRows,
      loops,
      rowsRemoved,
      estimatedRows,

      examinedRows:
        (
          actualRows +
          rowsRemoved
        ) *
        Math.max(
          loops,
          1,
        ),
    });
  }

  for (
    const child
    of plan.Plans ??
    []
  ) {
    collectRelationScans(
      child,
      output,
    );
  }

  return output;
}

async function explainEvent(
  event:
    QueryEvent,
  surface:
    string,
): Promise<PlanReport> {
  const result =
    await fixture()
      .query(
        `
          EXPLAIN (
            ANALYZE,
            BUFFERS,
            FORMAT JSON
          )
          ${event.query}
        `,
        parseEventParams(
          event,
        ),
      );

  const document =
    result.rows[0]?.[
      "QUERY PLAN"
    ];

  const root =
    Array.isArray(
      document,
    )
      ? document[0]
      : document;

  if (
    !root ||
    typeof root !==
      "object"
  ) {
    throw new Error(
      "PostgreSQL did not return a JSON query plan.",
    );
  }

  const planDocument =
    root as Record<
      string,
      unknown
    >;

  const plan =
    planDocument[
      "Plan"
    ];

  if (
    !plan ||
    typeof plan !==
      "object"
  ) {
    throw new Error(
      "PostgreSQL query plan did not contain Plan.",
    );
  }

  return {
    surface,

    planningMs:
      typeof planDocument[
        "Planning Time"
      ] ===
        "number"
        ? Number(
            planDocument[
              "Planning Time"
            ],
          )
        : null,

    executionMs:
      typeof planDocument[
        "Execution Time"
      ] ===
        "number"
        ? Number(
            planDocument[
              "Execution Time"
            ],
          )
        : null,

    scans:
      collectRelationScans(
        plan as PlanNode,
      ),
  };
}

function classifyEvent(
  event:
    QueryEvent,
): string {
  if (
    /public_teacher_discovery_eligibility/i.test(
      event.query,
    )
  ) {
    return "projection";
  }

  if (
    /teacher_profile/i.test(
      event.query,
    )
  ) {
    return "profile";
  }

  if (
    /teacher_availability_rule/i.test(
      event.query,
    )
  ) {
    return "rules";
  }

  if (
    /teacher_availability_exception/i.test(
      event.query,
    )
  ) {
    return "exceptions";
  }

  if (
    /speaking_session/i.test(
      event.query,
    )
  ) {
    return "sessions";
  }

  return "other";
}

function scansFor(
  report:
    PlanReport,
  relation:
    string,
): RelationScan[] {
  return report.scans
    .filter(
      (
        scan,
      ) =>
        scan.relation ===
        relation,
    );
}

function examinedFor(
  report:
    PlanReport,
  relation:
    string,
): number {
  return scansFor(
    report,
    relation,
  ).reduce(
    (
      sum,
      scan,
    ) =>
      sum +
      scan.examinedRows,
    0,
  );
}

function percentile(
  values:
    readonly number[],
  fraction:
    number,
): number {
  const sorted =
    [...values].sort(
      (
        left,
        right,
      ) =>
        left -
        right,
    );

  const index =
    Math.min(
      sorted.length -
        1,
      Math.max(
        0,
        Math.ceil(
          sorted.length *
            fraction,
        ) -
          1,
      ),
    );

  return sorted[
    index
  ] ??
    0;
}

describe.sequential(
  `Track D public discovery remediation verification (${scale})`,
  () => {
    beforeAll(
      async () => {
        fixtureClient =
          new Client({
            connectionString,

            application_name:
              `takineo-track-d-remediation-${scale}`,
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

        await seedSyntheticDataset();

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
      "keeps candidate discovery and all downstream work page-bounded at the original adversarial distribution",
      async () => {
        const samples:
          number[] = [];

        const queryCounts:
          number[] = [];

        let representativeEvents:
          QueryEvent[] = [];

        for (
          let iteration =
            0;
          iteration <
            10;
          iteration +=
            1
        ) {
          clearObservedQueries();

          const startedAt =
            performance.now();

          const result =
            await listPublicTeachers(
              {
                cursor:
                  cursorBeforeFixtures,

                limit:
                  PAGE_SIZE,

                ...RANGE,
              },
              {
                now:
                  NOW,
              },
            );

          const elapsed =
            performance.now() -
            startedAt;

          expect(
            result.teachers,
          ).toHaveLength(
            PAGE_SIZE,
          );

          expect(
            result.teachers[0]
              ?.teacherProfileId,
          ).toBe(
            profileId(
              firstPublicIndex,
            ),
          );

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

          const serialized =
            JSON.stringify(
              result,
            );

          for (
            const forbidden
            of [
              "applicationStatus",
              "applicationReviewNote",
              "accountStatus",
              "uploadId",
              "assetId",
              "reviewPlaybackId",
              "PRIVATE REMEDIATION REVIEW NOTE",
              "@remediation.test",
            ]
          ) {
            expect(
              serialized,
            ).not.toContain(
              forbidden,
            );
          }

          const events =
            selectEvents();

          expect(
            events.some(
              hasPositiveSqlOffset,
            ),
          ).toBe(
            false,
          );

          samples.push(
            elapsed,
          );

          queryCounts.push(
            events.length,
          );

          if (
            iteration ===
              0
          ) {
            representativeEvents =
              events;
          }
        }

        expect(
          new Set(
            queryCounts,
          ).size,
        ).toBe(
          1,
        );

        const eventGroups =
          new Map<
            string,
            QueryEvent[]
          >();

        for (
          const event
          of representativeEvents
        ) {
          const surface =
            classifyEvent(
              event,
            );

          eventGroups.set(
            surface,
            [
              ...(
                eventGroups.get(
                  surface,
                ) ??
                []
              ),
              event,
            ],
          );
        }

        const projectionEvents =
          eventGroups.get(
            "projection",
          ) ??
          [];

        expect(
          projectionEvents,
        ).toHaveLength(
          1,
        );

        const profileEvents =
          eventGroups.get(
            "profile",
          ) ??
          [];

        expect(
          profileEvents.length,
        ).toBeGreaterThanOrEqual(
          1,
        );

        const availabilityEvents = [
          ...(
            eventGroups.get(
              "rules",
            ) ??
            []
          ),

          ...(
            eventGroups.get(
              "exceptions",
            ) ??
            []
          ),

          ...(
            eventGroups.get(
              "sessions",
            ) ??
            []
          ),
        ];

        expect(
          availabilityEvents,
        ).toHaveLength(
          3,
        );

        const plans:
          PlanReport[] = [];

        const projectionPlan =
          await explainEvent(
            projectionEvents[0],
            "projection",
          );

        plans.push(
          projectionPlan,
        );

        for (
          const [
            index,
            event,
          ]
          of profileEvents.entries()
        ) {
          plans.push(
            await explainEvent(
              event,
              `profile-${index + 1}`,
            ),
          );
        }

        for (
          const event
          of availabilityEvents
        ) {
          plans.push(
            await explainEvent(
              event,
              classifyEvent(
                event,
              ),
            ),
          );
        }

        const projectionRelations =
          new Set(
            projectionPlan.scans
              .map(
                (
                  scan,
                ) =>
                  scan.relation,
              )
              .filter(
                (
                  relation,
                ):
                  relation is string =>
                    relation !==
                    null,
              ),
          );

        expect(
          projectionRelations,
        ).toEqual(
          new Set([
            "public_teacher_discovery_eligibility",
          ]),
        );

        const projectionRowsExamined =
          examinedFor(
            projectionPlan,
            "public_teacher_discovery_eligibility",
          );

        const projectionCandidateWithinBound =
          projectionRowsExamined <=
          PAGE_SIZE + 1;

        if (
          scale >=
            10_000
        ) {
          expect(
            projectionCandidateWithinBound,
          ).toBe(
            true,
          );
        }
        else if (
          !projectionCandidateWithinBound
        ) {
          console.warn(
            `TRACK_D_PROJECTION_BOUND_DIAGNOSTIC scale=${scale} examined=${projectionRowsExamined} requiredMax=${PAGE_SIZE + 1}`,
          );
        }

        expect(
          examinedFor(
            projectionPlan,
            "teacher_profile",
          ),
        ).toBe(
          0,
        );

        expect(
          examinedFor(
            projectionPlan,
            "user",
          ),
        ).toBe(
          0,
        );

        expect(
          examinedFor(
            projectionPlan,
            "teacher_intro_video",
          ),
        ).toBe(
          0,
        );

        const projectionIndexes =
          scansFor(
            projectionPlan,
            "public_teacher_discovery_eligibility",
          )
            .map(
              (
                scan,
              ) =>
                scan.indexName,
            )
            .filter(
              (
                indexName,
              ):
                indexName is string =>
                  indexName !==
                  null,
            );

        const projectionUsesPrimaryKey =
          projectionIndexes.includes(
            "public_teacher_discovery_eligibility_pkey",
          );

        if (
          scale >=
            10_000
        ) {
          expect(
            projectionUsesPrimaryKey,
          ).toBe(
            true,
          );
        }
        else if (
          !projectionUsesPrimaryKey
        ) {
          console.warn(
            `TRACK_D_PROJECTION_INDEX_DIAGNOSTIC scale=${scale} indexes=${JSON.stringify(projectionIndexes)}`,
          );
        }

        const profilePlans =
          plans.filter(
            (
              report,
            ) =>
              report.surface.startsWith(
                "profile-",
              ),
          );

        const profileRowsExaminedPhysical =
          profilePlans.reduce(
            (
              sum,
              report,
            ) =>
              sum +
              examinedFor(
                report,
                "teacher_profile",
              ),
            0,
          );

        const profileRowsFetched =
          profilePlans.reduce(
            (
              sum,
              report,
            ) =>
              sum +
              scansFor(
                report,
                "teacher_profile",
              ).reduce(
                (
                  relationSum,
                  scan,
                ) =>
                  relationSum +
                  (
                    scan.actualRows *
                    Math.max(
                      scan.loops,
                      1,
                    )
                  ),
                0,
              ),
            0,
          );

        /*
         * "Rows fetched" is the bounded result work attributable to the
         * 40-ID profile query. PostgreSQL may physically scan a tiny table
         * at 1k when that is cheaper; record that separately. At the
         * representative 10k scale, require physical page-bounded traversal.
         */
        expect(
          profileRowsFetched,
        ).toBeLessThanOrEqual(
          PAGE_SIZE *
            2,
        );

        if (
          scale >=
            10_000
        ) {
          expect(
            profileRowsExaminedPhysical,
          ).toBeLessThanOrEqual(
            PAGE_SIZE *
              2,
          );
        }
        else if (
          profileRowsExaminedPhysical >
            PAGE_SIZE *
              2
        ) {
          console.warn(
            `TRACK_D_PROFILE_PHYSICAL_SCAN_DIAGNOSTIC scale=${scale} examined=${profileRowsExaminedPhysical} fetched=${profileRowsFetched}`,
          );
        }

        const profileUserWork =
          profilePlans.reduce(
            (
              sum,
              report,
            ) =>
              sum +
              examinedFor(
                report,
                "user",
              ),
            0,
          );

        const profileVideoWork =
          profilePlans.reduce(
            (
              sum,
              report,
            ) =>
              sum +
              examinedFor(
                report,
                "teacher_intro_video",
              ),
            0,
          );

        const rulePlan =
          plans.find(
            (
              report,
            ) =>
              report.surface ===
              "rules",
          );

        const exceptionPlan =
          plans.find(
            (
              report,
            ) =>
              report.surface ===
              "exceptions",
          );

        const sessionPlan =
          plans.find(
            (
              report,
            ) =>
              report.surface ===
              "sessions",
          );

        expect(
          rulePlan,
        ).toBeDefined();

        expect(
          exceptionPlan,
        ).toBeDefined();

        expect(
          sessionPlan,
        ).toBeDefined();

        const availabilityRowsExamined = {
          rules:
            rulePlan
              ? examinedFor(
                  rulePlan,
                  "teacher_availability_rule",
                )
              : -1,

          exceptions:
            exceptionPlan
              ? examinedFor(
                  exceptionPlan,
                  "teacher_availability_exception",
                )
              : -1,

          sessions:
            sessionPlan
              ? examinedFor(
                  sessionPlan,
                  "speaking_session",
                )
              : -1,
        };

        const availabilityPhysicalWithinPageBound = {
          rules:
            availabilityRowsExamined.rules <=
            PAGE_SIZE,

          exceptions:
            availabilityRowsExamined.exceptions <=
            PAGE_SIZE,

          sessions:
            availabilityRowsExamined.sessions <=
            PAGE_SIZE,
        };

        /*
         * Control Room interpretation B:
         *
         * At tiny relations PostgreSQL may choose a sequential scan when
         * that is cheaper. Preserve those physical-scan counts as
         * diagnostics at 1k, while the representative 10k scale must
         * demonstrate page-bounded physical work.
         */
        if (
          scale >=
            10_000
        ) {
          expect(
            availabilityPhysicalWithinPageBound.rules,
          ).toBe(
            true,
          );

          expect(
            availabilityPhysicalWithinPageBound.exceptions,
          ).toBe(
            true,
          );

          expect(
            availabilityPhysicalWithinPageBound.sessions,
          ).toBe(
            true,
          );
        }
        else {
          for (
            const [
              surface,
              withinBound,
            ]
            of Object.entries(
              availabilityPhysicalWithinPageBound,
            )
          ) {
            if (
              !withinBound
            ) {
              console.warn(
                `TRACK_D_AVAILABILITY_PHYSICAL_SCAN_DIAGNOSTIC scale=${scale} surface=${surface} examined=${availabilityRowsExamined[surface as keyof typeof availabilityRowsExamined]} pageSize=${PAGE_SIZE}`,
              );
            }
          }
        }

        clearObservedQueries();

        const firstPage =
          await listPublicTeachers(
            {
              cursor:
                cursorBeforeFixtures,

              limit:
                PAGE_SIZE,

              ...RANGE,
            },
            {
              now:
                NOW,
            },
          );

        expect(
          firstPage.nextCursor,
        ).not.toBeNull();

        const firstPageIds =
          firstPage.teachers.map(
            (
              teacher,
            ) =>
              teacher.teacherProfileId,
          );

        clearObservedQueries();

        const secondPage =
          await listPublicTeachers(
            {
              cursor:
                firstPage.nextCursor ??
                undefined,

              limit:
                PAGE_SIZE,

              ...RANGE,
            },
            {
              now:
                NOW,
            },
          );

        expect(
          secondPage.teachers,
        ).toHaveLength(
          PAGE_SIZE,
        );

        const secondPageIds =
          secondPage.teachers.map(
            (
              teacher,
            ) =>
              teacher.teacherProfileId,
          );

        expect(
          secondPageIds[0] >
            (
              firstPageIds.at(-1) ??
              ""
            ),
        ).toBe(
          true,
        );

        expect(
          secondPageIds.some(
            (
              id,
            ) =>
              firstPageIds.includes(
                id,
              ),
          ),
        ).toBe(
          false,
        );

        expect(
          selectEvents().some(
            hasPositiveSqlOffset,
          ),
        ).toBe(
          false,
        );

        const metric = {
          sourceCandidate:
            "087d55da6d0a403048fc83208c1407c09382039a",

          scale,

          adversarialDistribution:
            "first ~90% ordered IDs non-public; final ~10% public",

          pageSize:
            PAGE_SIZE,

          returnedTeacherCount:
            PAGE_SIZE,

          totalQueryCountPerPage:
            queryCounts[0] ??
            0,

          projectionCandidateRowsExamined:
            projectionRowsExamined,

          projectionCandidateWithinBound,

          projectionIndexes,

          projectionUsesPrimaryKey,

          projectionRelations:
            [
              ...projectionRelations,
            ],

          teacherProfileRowsFetched:
            profileRowsFetched,

          teacherProfileRowsExaminedPhysical:
            profileRowsExaminedPhysical,

          eligibilityUserLookups:
            examinedFor(
              projectionPlan,
              "user",
            ),

          eligibilityIntroVideoLookups:
            examinedFor(
              projectionPlan,
              "teacher_intro_video",
            ),

          boundedProfileUserWork:
            profileUserWork,

          boundedProfileIntroVideoWork:
            profileVideoWork,

          availabilityQueryCount:
            availabilityEvents.length,

          availabilityRowsExamined,

          availabilityPhysicalWithinPageBound,

          cursor:
            {
              firstPageNextCursor:
                firstPage.nextCursor,

              secondPageReturned:
                secondPage.teachers.length,

              deterministicAscending:
                secondPageIds[0] >
                (
                  firstPageIds.at(-1) ??
                  ""
                ),

              duplicateAcrossPages:
                secondPageIds.some(
                  (
                    id,
                  ) =>
                    firstPageIds.includes(
                      id,
                    ),
                ),
            },

          positiveOffsetObserved:
            false,

          latencyObservationOnly:
            {
              sequentialSamples:
                samples.length,

              p50Ms:
                percentile(
                  samples,
                  0.5,
                ),

              p95Ms:
                percentile(
                  samples,
                  0.95,
                ),

              p99Ms:
                percentile(
                  samples,
                  0.99,
                ),

              minMs:
                Math.min(
                  ...samples,
                ),

              maxMs:
                Math.max(
                  ...samples,
                ),
            },

          plans,
        };

        console.log(
          `TRACK_D_DISCOVERY_REMEDIATION_METRIC ${JSON.stringify(
            metric,
          )}`,
        );
      },
    );
  },
);
