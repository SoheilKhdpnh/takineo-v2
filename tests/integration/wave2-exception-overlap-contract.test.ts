import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
} from "vitest";

import {
  Client,
} from "pg";

import {
  getTestDatabaseUrl,
} from "@/tests/support/test-database-url";

const connectionString =
  getTestDatabaseUrl();

const IDS = {
  teacherUser:
    "it_wave2_exception_overlap_user",

  teacherProfile:
    "it_wave2_exception_overlap_teacher",

  available:
    "it_wave2_exception_overlap_available",

  unavailable:
    "it_wave2_exception_overlap_unavailable",
} as const;

let client:
  Client | null =
    null;

async function cleanup():
  Promise<void> {
  if (!client) {
    return;
  }

  await client.query(
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

  await client.query(
    `
      DELETE FROM
        "teacher_profile"
      WHERE
        "id" = $1
    `,
    [
      IDS.teacherProfile,
    ],
  );

  await client.query(
    `
      DELETE FROM
        "user"
      WHERE
        "id" = $1
    `,
    [
      IDS.teacherUser,
    ],
  );
}

beforeAll(
  async () => {
    client =
      new Client({
        connectionString,

        application_name:
          "takineo-wave2-exception-overlap-contract",
      });

    await client.connect();

    await cleanup();

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
          'Wave 2 Exception Contract Teacher',
          'wave2-exception-overlap@example.test',
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

    await client.query(
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
  },
);

afterAll(
  async () => {
    try {
      await cleanup();
    }
    finally {
      if (client) {
        await client.end();

        client =
          null;
      }
    }
  },
);

describe.sequential(
  "Wave 2 availability exception database contract",
  () => {
    test(
      "allows AVAILABLE and UNAVAILABLE exceptions to overlap so projection precedence can resolve them",
      async () => {
        if (!client) {
          throw new Error(
            "Test PostgreSQL client is unavailable.",
          );
        }

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
                "createdAt",
                "updatedAt"
              )
            VALUES (
              $1,
              $2,
              DATE '2026-08-20',
              540,
              600,
              'AVAILABLE',
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
          `,
          [
            IDS.available,
            IDS.teacherProfile,
          ],
        );

        /*
         * This partial overlap is intentional:
         *
         * AVAILABLE   09:00 - 10:00
         * UNAVAILABLE 09:15 - 09:30
         *
         * The domain projection owns precedence.
         * PostgreSQL must not make that state
         * impossible to represent.
         */
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
                "createdAt",
                "updatedAt"
              )
            VALUES (
              $1,
              $2,
              DATE '2026-08-20',
              555,
              570,
              'UNAVAILABLE',
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
          `,
          [
            IDS.unavailable,
            IDS.teacherProfile,
          ],
        );

        const stored =
          await client.query<{
            id: string;
            type:
              "AVAILABLE" |
              "UNAVAILABLE";
            startMinute:
              number;
            endMinute:
              number;
          }>(
            `
              SELECT
                "id",
                "type"::text
                  AS type,
                "startMinute",
                "endMinute"
              FROM
                "teacher_availability_exception"
              WHERE
                "teacherProfileId" = $1
              ORDER BY
                "startMinute" ASC,
                "id" ASC
            `,
            [
              IDS.teacherProfile,
            ],
          );

        expect(
          stored.rows,
        ).toEqual([
          {
            id:
              IDS.available,

            type:
              "AVAILABLE",

            startMinute:
              540,

            endMinute:
              600,
          },

          {
            id:
              IDS.unavailable,

            type:
              "UNAVAILABLE",

            startMinute:
              555,

            endMinute:
              570,
          },
        ]);
      },
    );
  },
);
