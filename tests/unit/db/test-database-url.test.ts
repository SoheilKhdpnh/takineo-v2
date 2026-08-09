import {
  describe,
  expect,
  it,
} from "vitest";

import {
  getTestDatabaseUrl,
  TestDatabaseConfigurationError,
  type TestDatabaseEnvironment,
} from "@/tests/support/test-database-url";

function environment(
  overrides: TestDatabaseEnvironment = {},
): TestDatabaseEnvironment {
  return {
    DATABASE_URL:
      "postgresql://app:secret@production.example.com:5432/takineo",
    DIRECT_URL:
      "postgresql://app:secret@direct.example.com:5432/takineo",
    ...overrides,
  };
}

describe("TEST_DATABASE_URL safety guard", () => {
  it("fails closed when TEST_DATABASE_URL is missing", () => {
    expect(() =>
      getTestDatabaseUrl(environment()),
    ).toThrow(TestDatabaseConfigurationError);
  });

  it("fails closed when TEST_DATABASE_URL is blank", () => {
    expect(() =>
      getTestDatabaseUrl(
        environment({
          TEST_DATABASE_URL: "   ",
        }),
      ),
    ).toThrow(
      "TEST_DATABASE_URL is required for database tests.",
    );
  });

  it("rejects a malformed URL", () => {
    expect(() =>
      getTestDatabaseUrl(
        environment({
          TEST_DATABASE_URL: "not-a-url",
        }),
      ),
    ).toThrow(
      "TEST_DATABASE_URL must be a valid PostgreSQL URL.",
    );
  });

  it.each([
    "https://example.com/database",
    "mysql://user:secret@localhost/test",
    "file:./test.db",
  ])(
    "rejects non-PostgreSQL URL %s",
    (TEST_DATABASE_URL) => {
      expect(() =>
        getTestDatabaseUrl(
          environment({
            TEST_DATABASE_URL,
          }),
        ),
      ).toThrow(
        "TEST_DATABASE_URL must use the postgres or postgresql protocol.",
      );
    },
  );

  it("rejects TEST_DATABASE_URL equal to DATABASE_URL", () => {
    const DATABASE_URL =
      "postgresql://app:secret@production.example.com:5432/takineo";

    expect(() =>
      getTestDatabaseUrl({
        DATABASE_URL,
        DIRECT_URL:
          "postgresql://app:secret@direct.example.com:5432/takineo",
        TEST_DATABASE_URL: DATABASE_URL,
      }),
    ).toThrow(
      "TEST_DATABASE_URL must not equal DATABASE_URL.",
    );
  });

  it("rejects TEST_DATABASE_URL equal to DIRECT_URL", () => {
    const DIRECT_URL =
      "postgresql://app:secret@direct.example.com:5432/takineo";

    expect(() =>
      getTestDatabaseUrl({
        DATABASE_URL:
          "postgresql://app:secret@production.example.com:5432/takineo",
        DIRECT_URL,
        TEST_DATABASE_URL: DIRECT_URL,
      }),
    ).toThrow(
      "TEST_DATABASE_URL must not equal DIRECT_URL.",
    );
  });

  it.each([
    "postgresql://tester:secret@localhost:5432/takineo_test",
    "postgres://tester:secret@localhost:5432/takineo_test",
  ])(
    "accepts isolated PostgreSQL test URL using %s",
    (TEST_DATABASE_URL) => {
      expect(
        getTestDatabaseUrl(
          environment({
            TEST_DATABASE_URL,
          }),
        ),
      ).toBe(TEST_DATABASE_URL);
    },
  );

  it("does not expose database credentials in configuration errors", () => {
    const secret = "VERY_PRIVATE_PASSWORD";

    let thrown: unknown;

    try {
      getTestDatabaseUrl(
        environment({
          TEST_DATABASE_URL: `mysql://tester:${secret}@localhost/test`,
        }),
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain(
      secret,
    );
  });
});
