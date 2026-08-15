const EXPECTED_E2E_DATABASE = "takineo_e2e";
const EXPECTED_E2E_USER = "takineo_e2e";
const EXPECTED_E2E_HOST = "127.0.0.1";
const EXPECTED_E2E_PORT = "5432";
const EXPECTED_PROTOCOL = "postgresql:";

export const E2E_DATABASE_RESET_ACK = "RESET_TAKINEO_E2E_DATABASE";

export class E2EDatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "E2EDatabaseConfigurationError";
  }
}

export type E2EDatabaseEnvironment = {
  E2E_DATABASE_URL?: string;
  E2E_DATABASE_RESET_ACK?: string;
  TEST_DATABASE_URL?: string;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  PLAYWRIGHT_TEST?: string;
  TAKINEO_E2E_RUNTIME?: string;
  E2E_BASE_DATABASE_URL?: string;
  E2E_BASE_DIRECT_URL?: string;
};

function getProcessE2EDatabaseEnvironment(): E2EDatabaseEnvironment {
  return {
    E2E_DATABASE_URL: process.env.E2E_DATABASE_URL,
    E2E_DATABASE_RESET_ACK: process.env.E2E_DATABASE_RESET_ACK,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    PLAYWRIGHT_TEST: process.env.PLAYWRIGHT_TEST,
    TAKINEO_E2E_RUNTIME: process.env.TAKINEO_E2E_RUNTIME,
    E2E_BASE_DATABASE_URL: process.env.E2E_BASE_DATABASE_URL,
    E2E_BASE_DIRECT_URL: process.env.E2E_BASE_DIRECT_URL,
  };
}

function normalizeDatabaseUrl(value: string): string {
  try {
    return new URL(value).toString();
  } catch {
    return value.trim();
  }
}

export function getE2EDatabaseUrl(
  environment: E2EDatabaseEnvironment = getProcessE2EDatabaseEnvironment(),
): string {
  const rawUrl = environment.E2E_DATABASE_URL?.trim();

  if (!rawUrl) {
    throw new E2EDatabaseConfigurationError(
      "E2E_DATABASE_URL is required for browser tests.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new E2EDatabaseConfigurationError(
      "E2E_DATABASE_URL must be a valid PostgreSQL URL.",
    );
  }

  if (parsed.protocol !== EXPECTED_PROTOCOL) {
    throw new E2EDatabaseConfigurationError(
      "E2E_DATABASE_URL must use the postgresql protocol.",
    );
  }

  if (
    parsed.hostname !== EXPECTED_E2E_HOST ||
    parsed.port !== EXPECTED_E2E_PORT ||
    decodeURIComponent(parsed.username) !== EXPECTED_E2E_USER ||
    decodeURIComponent(parsed.pathname.replace(/^\//, "")) !==
      EXPECTED_E2E_DATABASE
  ) {
    throw new E2EDatabaseConfigurationError(
      "E2E_DATABASE_URL must target the isolated local takineo_e2e database identity.",
    );
  }

  if (!parsed.password) {
    throw new E2EDatabaseConfigurationError(
      "E2E_DATABASE_URL must include the dedicated test-role password.",
    );
  }

  const normalized = normalizeDatabaseUrl(rawUrl);
  const isPlaywrightRuntime =
    environment.PLAYWRIGHT_TEST === "1" &&
    environment.TAKINEO_E2E_RUNTIME === "1";

  if (isPlaywrightRuntime) {
    for (const [name, value] of [
      ["DATABASE_URL", environment.DATABASE_URL],
      ["DIRECT_URL", environment.DIRECT_URL],
    ] as const) {
      if (!value?.trim() || normalizeDatabaseUrl(value) !== normalized) {
        throw new E2EDatabaseConfigurationError(
          `Playwright E2E runtime requires ${name} to equal E2E_DATABASE_URL.`,
        );
      }
    }

    for (const [name, value] of [
      ["E2E_BASE_DATABASE_URL", environment.E2E_BASE_DATABASE_URL],
      ["E2E_BASE_DIRECT_URL", environment.E2E_BASE_DIRECT_URL],
      ["TEST_DATABASE_URL", environment.TEST_DATABASE_URL],
    ] as const) {
      if (!value?.trim()) continue;
      if (normalizeDatabaseUrl(value) === normalized) {
        throw new E2EDatabaseConfigurationError(
          `E2E_DATABASE_URL must not equal ${name}.`,
        );
      }
    }
  } else {
    for (const [name, value] of [
      ["DATABASE_URL", environment.DATABASE_URL],
      ["DIRECT_URL", environment.DIRECT_URL],
      ["TEST_DATABASE_URL", environment.TEST_DATABASE_URL],
    ] as const) {
      if (!value?.trim()) continue;
      if (normalizeDatabaseUrl(value) === normalized) {
        throw new E2EDatabaseConfigurationError(
          `E2E_DATABASE_URL must not equal ${name}.`,
        );
      }
    }
  }

  return rawUrl;
}

export function requireE2EDatabaseResetAcknowledgement(
  environment: E2EDatabaseEnvironment = getProcessE2EDatabaseEnvironment(),
): void {
  if (environment.E2E_DATABASE_RESET_ACK !== E2E_DATABASE_RESET_ACK) {
    throw new E2EDatabaseConfigurationError(
      `E2E database reset requires E2E_DATABASE_RESET_ACK=${E2E_DATABASE_RESET_ACK}.`,
    );
  }
}

export const expectedE2EDatabaseIdentity = {
  databaseName: EXPECTED_E2E_DATABASE,
  userName: EXPECTED_E2E_USER,
  serverAddress: EXPECTED_E2E_HOST,
  serverPort: Number(EXPECTED_E2E_PORT),
} as const;
