import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
} from "vitest";

import pg from "pg";

import {
  createTestPrismaClient,
} from "@/tests/support/test-prisma-client";

const {
  Client,
} = pg;

const prisma =
  createTestPrismaClient();

const FIXTURE_COUNT =
  1_000;

const PAGE_LIMIT =
  40;

const QUERY_LIMIT =
  PAGE_LIMIT + 1;

const USER_PREFIX =
  "zz_it_projection_plan_user_";

const PROFILE_PREFIX =
  "zz_it_projection_plan_profile_";

const VIDEO_PREFIX =
  "zz_it_projection_plan_video_";

function padded(
  value:
    number,
): string {
  return value
    .toString()
    .padStart(
      6,
      "0",
    );
}

function userId(
  index:
    number,
): string {
  return `${USER_PREFIX}${padded(index)}`;
}

function profileId(
  index:
    number,
): string {
  return `${PROFILE_PREFIX}${padded(index)}`;
}

function videoId(
  index:
    number,
): string {
  return `${VIDEO_PREFIX}${padded(index)}`;
}

async function cleanup():
  Promise<void> {
  /*
   * User deletion cascades through TeacherProfile, which in turn
   * cascades intro-video and discovery-projection membership.
   */
  await prisma.user.deleteMany({
    where: {
      id: {
        startsWith:
          USER_PREFIX,
      },
    },
  });
}

type ExplainNode = {
  "Node Type":
    string;

  "Relation Name"?:
    string;

  "Index Name"?:
    string;

  "Actual Rows"?:
    number;

  "Actual Loops"?:
    number;

  "Rows Removed by Filter"?:
    number;

  "Shared Hit Blocks"?:
    number;

  "Shared Read Blocks"?:
    number;

  Plans?:
    ExplainNode[];
};

type ExplainDocument = {
  Plan:
    ExplainNode;

  "Planning Time"?:
    number;

  "Execution Time"?:
    number;
};

function flattenPlan(
  node:
    ExplainNode,
): ExplainNode[] {
  return [
    node,
    ...(
      node.Plans ?? []
    ).flatMap(
      flattenPlan,
    ),
  ];
}

describe.sequential(
  "Wave 2 public teacher discovery projection query plan",
  () => {
    beforeAll(
      async () => {
        await cleanup();

        const timestamp =
          new Date(
            "2026-08-18T00:00:00.000Z",
          );

        await prisma.user.createMany({
          data:
            Array.from(
              {
                length:
                  FIXTURE_COUNT,
              },
              (
                _,
                index,
              ) => ({
                id:
                  userId(
                    index,
                  ),

                name:
                  `Projection plan teacher ${index}`,

                email:
                  `${userId(index)}@example.test`,

                emailVerified:
                  true,

                role:
                  "TEACHER" as const,

                accountStatus:
                  "ACTIVE" as const,

                createdAt:
                  timestamp,

                updatedAt:
                  timestamp,
              }),
            ),
        });

        await prisma.teacherProfile.createMany({
          data:
            Array.from(
              {
                length:
                  FIXTURE_COUNT,
              },
              (
                _,
                index,
              ) => ({
                id:
                  profileId(
                    index,
                  ),

                userId:
                  userId(
                    index,
                  ),

                headline:
                  "Projection query-plan fixture",

                bio:
                  "Synthetic canonical-public teacher used only for isolated PostgreSQL query-plan verification.",

                nativeLanguage:
                  "fa" as const,

                teachingLanguage:
                  "en" as const,

                timezone:
                  "Asia_Tehran" as const,

                applicationStatus:
                  "APPROVED" as const,

                profileCompletedAt:
                  timestamp,
              }),
            ),
        });

        await prisma.teacherIntroVideo.createMany({
          data:
            Array.from(
              {
                length:
                  FIXTURE_COUNT,
              },
              (
                _,
                index,
              ) => ({
                id:
                  videoId(
                    index,
                  ),

                teacherProfileId:
                  profileId(
                    index,
                  ),

                status:
                  "APPROVED" as const,

                durationSeconds:
                  90,
              }),
            ),
        });

        await prisma
          .publicTeacherDiscoveryEligibility
          .createMany({
            data:
              Array.from(
                {
                  length:
                    FIXTURE_COUNT,
                },
                (
                  _,
                  index,
                ) => ({
                  teacherProfileId:
                    profileId(
                      index,
                    ),
                }),
              ),
          });

        /*
         * Make planner statistics representative before EXPLAIN.
         */
        await prisma.$executeRawUnsafe(
          'ANALYZE "public_teacher_discovery_eligibility"',
        );
      },
      30_000,
    );

    afterAll(
      async () => {
        try {
          await cleanup();
        }
        finally {
          await prisma.$disconnect();
        }
      },
      30_000,
    );

    test(
      "candidate keyset scan examines at most limit plus one projection rows",
      async () => {
        /*
         * Cursor late in the ordered projection leaves 100 rows
         * available, enough to prove LIMIT rather than end-of-table
         * behavior.
         */
        const cursor =
          profileId(
            899,
          );

        const client =
          new Client({
            connectionString:
              process.env.TEST_DATABASE_URL,
          });

        await client.connect();

        try {
          const identity =
            await client.query(`
              SELECT
                current_database() AS database,
                current_user AS username
            `);

          expect(
            identity.rows[0],
          ).toMatchObject({
            database:
              "takineo_test",

            username:
              "takineo_test",
          });

          const result =
            await client.query(
              `
                EXPLAIN (
                  ANALYZE,
                  BUFFERS,
                  FORMAT JSON
                )
                SELECT
                  "teacherProfileId"
                FROM
                  "public_teacher_discovery_eligibility"
                WHERE
                  "teacherProfileId" > $1
                ORDER BY
                  "teacherProfileId" ASC
                LIMIT ${QUERY_LIMIT}
              `,
              [
                cursor,
              ],
            );

          const explain =
            result.rows[0][
              "QUERY PLAN"
            ][0] as ExplainDocument;

          const nodes =
            flattenPlan(
              explain.Plan,
            );

          const relationNodes =
            nodes.filter(
              (
                node,
              ) =>
                typeof node[
                  "Relation Name"
                ] ===
                "string",
            );

          const relations =
            [
              ...new Set(
                relationNodes.map(
                  (
                    node,
                  ) =>
                    node[
                      "Relation Name"
                    ]!,
                ),
              ),
            ];

          /*
           * The candidate stage must touch only the durable
           * identifier-only projection. No teacher_profile/user/
           * intro-video eligibility joins are allowed here.
           */
          expect(
            relations,
          ).toEqual([
            "public_teacher_discovery_eligibility",
          ]);

          const projectionScan =
            relationNodes.find(
              (
                node,
              ) =>
                node[
                  "Relation Name"
                ] ===
                "public_teacher_discovery_eligibility",
            );

          expect(
            projectionScan,
          ).toBeDefined();

          /*
           * A primary-key/index scan is the expected scalable path.
           */
          expect(
            projectionScan![
              "Node Type"
            ],
          ).toMatch(
            /Index/,
          );

          expect(
            projectionScan![
              "Index Name"
            ],
          ).toBe(
            "public_teacher_discovery_eligibility_pkey",
          );

          /*
           * This is the architectural invariant that replaces the
           * old 9,041-row eligibility scan for a 40-teacher page.
           */
          expect(
            projectionScan![
              "Actual Rows"
            ],
          ).toBeLessThanOrEqual(
            QUERY_LIMIT,
          );

          expect(
            projectionScan![
              "Actual Loops"
            ],
          ).toBe(
            1,
          );

          expect(
            projectionScan![
              "Rows Removed by Filter"
            ] ?? 0,
          ).toBe(
            0,
          );

          expect(
            explain.Plan[
              "Actual Rows"
            ],
          ).toBe(
            QUERY_LIMIT,
          );

          console.log(
            JSON.stringify(
              {
                requestedPage:
                  PAGE_LIMIT,

                candidateLimit:
                  QUERY_LIMIT,

                fixturePopulation:
                  FIXTURE_COUNT,

                cursor,

                nodeType:
                  projectionScan![
                    "Node Type"
                  ],

                indexName:
                  projectionScan![
                    "Index Name"
                  ],

                projectionRowsReturned:
                  projectionScan![
                    "Actual Rows"
                  ],

                rowsRemovedByFilter:
                  projectionScan![
                    "Rows Removed by Filter"
                  ] ?? 0,

                sharedHitBlocks:
                  projectionScan![
                    "Shared Hit Blocks"
                  ] ?? 0,

                sharedReadBlocks:
                  projectionScan![
                    "Shared Read Blocks"
                  ] ?? 0,

                planningTimeMs:
                  explain[
                    "Planning Time"
                  ],

                executionTimeMs:
                  explain[
                    "Execution Time"
                  ],

                relationsTouched:
                  relations,
              },
              null,
              2,
            ),
          );
        }
        finally {
          await client.end();
        }
      },
      30_000,
    );
  },
);
