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

const safeUrl =
  "postgresql://takineo_test:secret@127.0.0.1:5432/takineo_test";

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

  it.each([
    "postgresql://wrong:secret@127.0.0.1:5432/takineo_test",
    "postgresql://takineo_test:secret@localhost:5432/takineo_test",
    "postgresql://takineo_test:secret@127.0.0.1:5433/takineo_test",
    "postgresql://takineo_test:secret@127.0.0.1:5432/wrong",
  ])("rejects noncanonical test identity %s", (TEST_DATABASE_URL) => {
    expect(() =>
      getTestDatabaseUrl(environment({ TEST_DATABASE_URL })),
    ).toThrow(
      "TEST_DATABASE_URL must target the isolated local takineo_test database identity.",
    );
  });

  it("rejects a canonical test URL without the dedicated role password", () => {
    expect(() =>
      getTestDatabaseUrl(
        environment({
          TEST_DATABASE_URL:
            "postgresql://takineo_test@127.0.0.1:5432/takineo_test",
        }),
      ),
    ).toThrow(
      "TEST_DATABASE_URL must include the dedicated test-role password.",
    );
  });

  it("rejects DATABASE_URL targeting the same database through different credentials", () => {
    expect(() =>
      getTestDatabaseUrl({
        TEST_DATABASE_URL: safeUrl,
        DATABASE_URL:
          "postgresql://application_role:different-password@127.0.0.1:5432/takineo_test?application_name=app",
      }),
    ).toThrow(
      "TEST_DATABASE_URL must not target the same database identity as DATABASE_URL.",
    );
  });

  it("rejects DIRECT_URL targeting the same database through a different URL spelling", () => {
    expect(() =>
      getTestDatabaseUrl({
        TEST_DATABASE_URL: safeUrl,
        DIRECT_URL:
          "postgres://direct_role:other@127.0.0.1:5432/takineo_test",
      }),
    ).toThrow(
      "TEST_DATABASE_URL must not target the same database identity as DIRECT_URL.",
    );
  });

  it.each([
    safeUrl,
    "postgres://takineo_test:secret@127.0.0.1:5432/takineo_test",
  ])(
    "accepts the isolated local test identity using %s",
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
