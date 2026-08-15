import { describe, expect, it } from "vitest";

import {
  E2EDatabaseConfigurationError,
  E2E_DATABASE_RESET_ACK,
  getE2EDatabaseUrl,
  requireE2EDatabaseResetAcknowledgement,
  type E2EDatabaseEnvironment,
} from "@/tests/e2e/support/e2e-database-url";

const safeUrl =
  "postgresql://takineo_e2e:secret@127.0.0.1:5432/takineo_e2e";

function env(overrides: E2EDatabaseEnvironment = {}): E2EDatabaseEnvironment {
  return {
    DATABASE_URL:
      "postgresql://app:secret@production.example.com:5432/takineo",
    DIRECT_URL:
      "postgresql://app:secret@direct.example.com:5432/takineo",
    TEST_DATABASE_URL:
      "postgresql://takineo_test:secret@127.0.0.1:5432/takineo_test",
    ...overrides,
  };
}

describe("E2E_DATABASE_URL safety guard", () => {
  it("fails closed when the URL is missing", () => {
    expect(() => getE2EDatabaseUrl(env())).toThrow(
      E2EDatabaseConfigurationError,
    );
  });

  it.each([
    "postgres://takineo_e2e:secret@127.0.0.1:5432/takineo_e2e",
    "postgresql://wrong:secret@127.0.0.1:5432/takineo_e2e",
    "postgresql://takineo_e2e:secret@localhost:5432/takineo_e2e",
    "postgresql://takineo_e2e:secret@127.0.0.1:5433/takineo_e2e",
    "postgresql://takineo_e2e:secret@127.0.0.1:5432/wrong",
  ])("rejects noncanonical E2E identity %s", (E2E_DATABASE_URL) => {
    expect(() => getE2EDatabaseUrl(env({ E2E_DATABASE_URL }))).toThrow(
      E2EDatabaseConfigurationError,
    );
  });

  it.each(["DATABASE_URL", "DIRECT_URL", "TEST_DATABASE_URL"] as const)(
    "rejects equality with %s",
    (protectedVariable) => {
      expect(() =>
        getE2EDatabaseUrl(
          env({
            E2E_DATABASE_URL: safeUrl,
            [protectedVariable]: safeUrl,
          }),
        ),
      ).toThrow(`must not equal ${protectedVariable}`);
    },
  );

  it("rejects an E2E URL without the dedicated role password", () => {
    expect(() =>
      getE2EDatabaseUrl(
        env({
          E2E_DATABASE_URL:
            "postgresql://takineo_e2e@127.0.0.1:5432/takineo_e2e",
        }),
      ),
    ).toThrow("must include the dedicated test-role password");
  });

  it("accepts only the exact isolated local E2E identity", () => {
    expect(
      getE2EDatabaseUrl(
        env({ E2E_DATABASE_URL: safeUrl }),
      ),
    ).toBe(safeUrl);
  });

  it("does not expose E2E database credentials in configuration errors", () => {
    const secret = "VERY_PRIVATE_E2E_PASSWORD";
    let thrown: unknown;

    try {
      getE2EDatabaseUrl(
        env({
          E2E_DATABASE_URL: `mysql://takineo_e2e:${secret}@127.0.0.1:5432/takineo_e2e`,
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


  it("accepts controlled Playwright runtime aliases after parent preflight", () => {
    expect(
      getE2EDatabaseUrl(
        env({
          E2E_DATABASE_URL: safeUrl,
          PLAYWRIGHT_TEST: "1",
          TAKINEO_E2E_RUNTIME: "1",
          DATABASE_URL: safeUrl,
          DIRECT_URL: safeUrl,
          E2E_BASE_DATABASE_URL:
            "postgresql://app:secret@production.example.com:5432/takineo",
          E2E_BASE_DIRECT_URL:
            "postgresql://app:secret@direct.example.com:5432/takineo",
        }),
      ),
    ).toBe(safeUrl);
  });

  it("rejects a Playwright runtime whose original app database equals E2E", () => {
    expect(() =>
      getE2EDatabaseUrl(
        env({
          E2E_DATABASE_URL: safeUrl,
          PLAYWRIGHT_TEST: "1",
          TAKINEO_E2E_RUNTIME: "1",
          DATABASE_URL: safeUrl,
          DIRECT_URL: safeUrl,
          E2E_BASE_DATABASE_URL: safeUrl,
        }),
      ),
    ).toThrow("must not equal E2E_BASE_DATABASE_URL");
  });

  it("rejects a Playwright runtime that does not remap DATABASE_URL to E2E", () => {
    expect(() =>
      getE2EDatabaseUrl(
        env({
          E2E_DATABASE_URL: safeUrl,
          PLAYWRIGHT_TEST: "1",
          TAKINEO_E2E_RUNTIME: "1",
          DIRECT_URL: safeUrl,
          E2E_BASE_DATABASE_URL:
            "postgresql://app:secret@production.example.com:5432/takineo",
          E2E_BASE_DIRECT_URL:
            "postgresql://app:secret@direct.example.com:5432/takineo",
        }),
      ),
    ).toThrow("requires DATABASE_URL to equal E2E_DATABASE_URL");
  });

  it("still rejects TEST_DATABASE_URL reuse inside Playwright runtime", () => {
    expect(() =>
      getE2EDatabaseUrl(
        env({
          E2E_DATABASE_URL: safeUrl,
          PLAYWRIGHT_TEST: "1",
          TAKINEO_E2E_RUNTIME: "1",
          DATABASE_URL: safeUrl,
          DIRECT_URL: safeUrl,
          TEST_DATABASE_URL: safeUrl,
          E2E_BASE_DATABASE_URL:
            "postgresql://app:secret@production.example.com:5432/takineo",
          E2E_BASE_DIRECT_URL:
            "postgresql://app:secret@direct.example.com:5432/takineo",
        }),
      ),
    ).toThrow("must not equal TEST_DATABASE_URL");
  });

  it("requires an explicit destructive-reset acknowledgement", () => {
    expect(() => requireE2EDatabaseResetAcknowledgement(env())).toThrow(
      "E2E database reset requires",
    );
    expect(() =>
      requireE2EDatabaseResetAcknowledgement(
        env({ E2E_DATABASE_RESET_ACK }),
      ),
    ).not.toThrow();
  });
});
