import {
  afterAll,
  describe,
  expect,
  test,
} from "vitest";

import {
  createTestPrismaClient,
} from "@/tests/support/test-prisma-client";

const prisma =
  createTestPrismaClient();

describe(
  "test Prisma timezone",
  () => {
    afterAll(
      async () => {
        await prisma
          .$disconnect();
      },
    );

    test(
      "uses UTC for PrismaPg PostgreSQL sessions",
      async () => {
        const rows =
          await prisma
            .$queryRaw<
              Array<{
                timezone:
                  string;
              }>
            >`
              SELECT
                current_setting(
                  'TimeZone'
                )::text
                  AS "timezone"
            `;

        expect(
          rows,
        ).toEqual([
          {
            timezone:
              "UTC",
          },
        ]);
      },
    );
  },
);
