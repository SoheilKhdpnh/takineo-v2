import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

import {
  getE2EDatabaseUrl,
  requireE2EDatabaseResetAcknowledgement,
} from "./tests/e2e/support/e2e-database-url";

const baseURL = "http://127.0.0.1:3100";
const e2eDatabaseUrl = getE2EDatabaseUrl();
requireE2EDatabaseResetAcknowledgement();

const resetAcknowledgement = process.env.E2E_DATABASE_RESET_ACK ?? "";
const integrationDatabaseUrl = process.env.TEST_DATABASE_URL ?? "";
const applicationDatabaseUrl = process.env.DATABASE_URL ?? "";
const directDatabaseUrl = process.env.DIRECT_URL ?? "";
const e2eAuthSecret = "takineo-e2e-only-auth-secret-2026-08-15";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/e2e/global.setup.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  timeout: 90_000,
  expect: { timeout: 30_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "npm run e2e:prepare && npm run dev -- --webpack --hostname 127.0.0.1 --port 3100",
    url: `${baseURL}/en/sign-in`,
    wait: { stdout: /Ready in/ },
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PLAYWRIGHT_TEST: "1",
      TAKINEO_E2E_RUNTIME: "1",
      E2E_DATABASE_URL: e2eDatabaseUrl,
      E2E_DATABASE_RESET_ACK: resetAcknowledgement,
      TEST_DATABASE_URL: integrationDatabaseUrl,
      E2E_BASE_DATABASE_URL: applicationDatabaseUrl,
      E2E_BASE_DIRECT_URL: directDatabaseUrl,
      DATABASE_URL: e2eDatabaseUrl,
      DIRECT_URL: e2eDatabaseUrl,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_SECRET: e2eAuthSecret,
    },
  },
});
