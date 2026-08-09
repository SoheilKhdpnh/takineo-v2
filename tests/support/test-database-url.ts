const POSTGRES_PROTOCOLS = new Set([
  "postgres:",
  "postgresql:",
]);

export class TestDatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestDatabaseConfigurationError";
  }
}

function normalizeDatabaseUrl(value: string): string {
  try {
    return new URL(value).toString();
  } catch {
    return value.trim();
  }
}

export type TestDatabaseEnvironment = {
  TEST_DATABASE_URL?: string;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
};

export function getTestDatabaseUrl(
  environment: TestDatabaseEnvironment = {
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
  },
): string {
  const rawTestUrl =
    environment.TEST_DATABASE_URL?.trim();

  if (!rawTestUrl) {
    throw new TestDatabaseConfigurationError(
      "TEST_DATABASE_URL is required for database tests.",
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(rawTestUrl);
  } catch {
    throw new TestDatabaseConfigurationError(
      "TEST_DATABASE_URL must be a valid PostgreSQL URL.",
    );
  }

  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    throw new TestDatabaseConfigurationError(
      "TEST_DATABASE_URL must use the postgres or postgresql protocol.",
    );
  }

  const normalizedTestUrl =
    normalizeDatabaseUrl(rawTestUrl);

  const protectedUrls = [
    ["DATABASE_URL", environment.DATABASE_URL],
    ["DIRECT_URL", environment.DIRECT_URL],
  ] as const;

  for (const [name, value] of protectedUrls) {
    if (!value?.trim()) continue;

    if (
      normalizeDatabaseUrl(value) ===
      normalizedTestUrl
    ) {
      throw new TestDatabaseConfigurationError(
        `TEST_DATABASE_URL must not equal ${name}.`,
      );
    }
  }

  return rawTestUrl;
}
