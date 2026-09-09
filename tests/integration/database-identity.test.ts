import {
  afterAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  createTestPrismaClient,
} from "@/tests/support/test-prisma";

const prisma =
  createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("test database identity", () => {
  it("connects only to the isolated local Takineo test database", async () => {
    const rows = await prisma.$queryRaw<
      Array<{
        database_name: string;
        user_name: string;
        server_address: string;
        server_port: number;
      }>
    >`
      SELECT
        current_database()::text
          AS database_name,
        current_user::text
          AS user_name,
        host(inet_server_addr())::text
          AS server_address,
        inet_server_port()::int
          AS server_port
    `;

    expect(rows).toEqual([
      {
        database_name: "takineo_test",
        user_name: "takineo_test",
        server_address: "127.0.0.1",
        server_port: 5432,
      },
    ]);
  });
});
