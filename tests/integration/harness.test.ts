import {
  describe,
  expect,
  it,
} from "vitest";

import {
  getTestDatabaseUrl,
} from "@/tests/support/test-database-url";

describe("database integration harness", () => {
  it("uses an explicit test database distinct from protected application URLs", () => {
    const testDatabaseUrl =
      getTestDatabaseUrl();

    expect(
      process.env.TEST_DATABASE_URL,
    ).toBeTruthy();

    expect(testDatabaseUrl).toBe(
      process.env.TEST_DATABASE_URL,
    );

    expect(testDatabaseUrl).not.toBe(
      process.env.DATABASE_URL,
    );

    expect(testDatabaseUrl).not.toBe(
      process.env.DIRECT_URL,
    );
  });
});
