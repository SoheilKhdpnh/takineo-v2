import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

async function browserE2EEnvironmentBlock() {
  const workflow = (
    await readFile(
      join(process.cwd(), ".github", "workflows", "ci.yml"),
      "utf8",
    )
  ).replace(/\r\n/g, "\n");

  const job = workflow.match(/\n  e2e:\n([\s\S]*?)(?=\n  [a-z][a-z0-9_-]*:\n|$)/)?.[1];
  if (!job) throw new Error("Browser E2E CI job is missing.");

  const environment = job.match(/\n    env:\n([\s\S]*?)(?=\n    steps:\n)/)?.[1];
  if (!environment) throw new Error("Browser E2E CI environment is missing.");

  return environment;
}

describe("CI browser security contract", () => {
  it("supplies disposable Better Auth runtime configuration on a clean runner", async () => {
    const environment = await browserE2EEnvironmentBlock();

    expect(environment).toContain(
      "BETTER_AUTH_URL: http://127.0.0.1:3100",
    );
    expect(environment).toContain(
      "BETTER_AUTH_SECRET: ci-only-secret-with-at-least-32-characters",
    );
  });

  it("keeps integration and browser database identities distinct", async () => {
    const environment = await browserE2EEnvironmentBlock();

    expect(environment).toContain(
      "TEST_DATABASE_URL: postgresql://takineo_test:",
    );
    expect(environment).toContain(
      "E2E_DATABASE_URL: postgresql://takineo_e2e:",
    );
    expect(environment).not.toContain(
      "TEST_DATABASE_URL: postgresql://takineo_e2e:",
    );
  });

  it("keeps destructive E2E reset acknowledgement explicit", async () => {
    const environment = await browserE2EEnvironmentBlock();

    expect(environment).toContain(
      "E2E_DATABASE_RESET_ACK: RESET_TAKINEO_E2E_DATABASE",
    );
  });

  it("keeps the production dependency audit in the quality gate", async () => {
    const workflow = (
      await readFile(
        join(process.cwd(), ".github", "workflows", "ci.yml"),
        "utf8",
      )
    ).replace(/\r\n/g, "\n");

    expect(workflow).toContain("- name: Production dependency audit");
    expect(workflow).toContain("run: npm run security:audit:prod");
  });
});
