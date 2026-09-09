const POSTGRES_PROTOCOLS = new Set([
  "postgres:",
  "postgresql:",
]);

const EXPECTED_TEST_DATABASE = "takineo_test";
const EXPECTED_TEST_USER = "takineo_test";
const EXPECTED_TEST_HOST = "127.0.0.1";
const EXPECTED_TEST_PORT = "5432";

export class TestDatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestDatabaseConfigurationError";
  }
}

type DatabaseIdentity = {
  hostname: string;
  port: string;
  database: string;
};

function parseDatabaseIdentity(value: string): DatabaseIdentity | null {
  try {
    const parsed = new URL(value);
    if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) return null;

    return {
      hostname: parsed.hostname,
      port: parsed.port || "5432",
      database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    };
  } catch {
    return null;
  }
}

function sameDatabaseIdentity(left: string, right: string): boolean {
  const leftIdentity = parseDatabaseIdentity(left);
  const rightIdentity = parseDatabaseIdentity(right);
  if (!leftIdentity || !rightIdentity) return false;

  return (
    leftIdentity.hostname === rightIdentity.hostname &&
    leftIdentity.port === rightIdentity.port &&
    leftIdentity.database === rightIdentity.database
  );
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
  const rawTestUrl = environment.TEST_DATABASE_URL?.trim();

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

  if (
    parsed.hostname !== EXPECTED_TEST_HOST ||
    (parsed.port || "5432") !== EXPECTED_TEST_PORT ||
    decodeURIComponent(parsed.username) !== EXPECTED_TEST_USER ||
    decodeURIComponent(parsed.pathname.replace(/^\//, "")) !==
      EXPECTED_TEST_DATABASE
  ) {
    throw new TestDatabaseConfigurationError(
      "TEST_DATABASE_URL must target the isolated local takineo_test database identity.",
    );
  }

  if (!parsed.password) {
    throw new TestDatabaseConfigurationError(
      "TEST_DATABASE_URL must include the dedicated test-role password.",
    );
  }

  for (const [name, value] of [
    ["DATABASE_URL", environment.DATABASE_URL],
    ["DIRECT_URL", environment.DIRECT_URL],
  ] as const) {
    if (!value?.trim()) continue;

    if (sameDatabaseIdentity(rawTestUrl, value)) {
      throw new TestDatabaseConfigurationError(
        `TEST_DATABASE_URL must not target the same database identity as ${name}.`,
      );
    }
  }

  return rawTestUrl;
}
