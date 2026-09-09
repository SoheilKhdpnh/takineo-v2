import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getInternalJobSecret: vi.fn(),
  processDue: vi.fn(),
  getHealth: vi.fn(),
}));

vi.mock("@/lib/env/internal-jobs", () => ({
  getInternalJobSecret: mocks.getInternalJobSecret,
}));

vi.mock("@/lib/services/mux-playback-reconciliation.service", () => ({
  processDueMuxPlaybackReconciliations: mocks.processDue,
  getMuxPlaybackReconciliationOperationalHealth: mocks.getHealth,
}));

import {
  dynamic,
  POST as runMuxReconciliationJob,
} from "@/app/api/internal/jobs/mux-playback-reconciliation/route";

const healthy = {
  status: "HEALTHY",
  sampledAt: "2026-08-14T10:30:00.000Z",
  due: 0,
  overdue: 0,
  durableFailures: 0,
  oldestDueAt: null,
  thresholds: {
    overdueSeconds: 900,
    durableFailureAttempts: 5,
  },
} as const;

function request(secret = "s".repeat(32), body: unknown = { limit: 10 }) {
  return new Request(
    "http://localhost:3000/api/internal/jobs/mux-playback-reconciliation",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-takineo-job-secret": secret,
      },
      body: JSON.stringify(body),
    },
  );
}

describe("Mux reconciliation internal job route", () => {
  beforeEach(() => {
    mocks.getInternalJobSecret.mockReset();
    mocks.processDue.mockReset();
    mocks.getHealth.mockReset();

    mocks.getInternalJobSecret.mockReturnValue("s".repeat(32));
    mocks.processDue.mockResolvedValue({
      selected: 2,
      succeeded: 2,
      failed: 0,
      requeued: 0,
      skipped: 0,
    });
    mocks.getHealth.mockResolvedValue(healthy);
  });

  it("is explicitly dynamic and cannot be cached", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("denies a missing scheduler secret before parsing the body or doing work", async () => {
    const response = await runMuxReconciliationJob(
      new Request(
        "http://localhost:3000/api/internal/jobs/mux-playback-reconciliation",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{not-json",
        },
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "INTERNAL_JOB_UNAUTHORIZED",
    });
    expect(mocks.processDue).not.toHaveBeenCalled();
  });

  it("denies a scheduler with the wrong secret before doing work", async () => {
    const response = await runMuxReconciliationJob(request("x".repeat(32)));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      error: "INTERNAL_JOB_UNAUTHORIZED",
    });
    expect(mocks.processDue).not.toHaveBeenCalled();
  });

  it("fails closed when internal-job authentication is not configured", async () => {
    mocks.getInternalJobSecret.mockImplementation(() => {
      throw new Error("not configured");
    });

    const response = await runMuxReconciliationJob(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "INTERNAL_JOB_NOT_CONFIGURED",
    });
    expect(mocks.processDue).not.toHaveBeenCalled();
  });

  it("rejects extra job fields after authentication", async () => {
    const response = await runMuxReconciliationJob(
      request(undefined, { limit: 10, actorUserId: "forged-admin" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_REQUEST",
    });
    expect(mocks.processDue).not.toHaveBeenCalled();
  });

  it("validates the bounded batch size after authentication", async () => {
    const response = await runMuxReconciliationJob(request(undefined, { limit: 51 }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_REQUEST",
    });
    expect(mocks.processDue).not.toHaveBeenCalled();
  });

  it("returns batch metrics and operational health when healthy", async () => {
    const response = await runMuxReconciliationJob(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.processDue).toHaveBeenCalledWith(10);
    await expect(response.json()).resolves.toEqual({
      result: {
        selected: 2,
        succeeded: 2,
        failed: 0,
        requeued: 0,
        skipped: 0,
      },
      health: healthy,
    });
  });

  it("returns 503 when durable failures or schedule lag make health degraded", async () => {
    mocks.getHealth.mockResolvedValue({
      ...healthy,
      status: "DEGRADED",
      due: 7,
      overdue: 2,
      durableFailures: 1,
      oldestDueAt: "2026-08-14T10:00:00.000Z",
    });

    const response = await runMuxReconciliationJob(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      health: {
        status: "DEGRADED",
        overdue: 2,
        durableFailures: 1,
      },
    });
  });

  it("maps unexpected processing failures to a private operational error", async () => {
    mocks.processDue.mockRejectedValue(new Error("provider exploded"));

    const response = await runMuxReconciliationJob(request());

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      error: "MUX_RECONCILIATION_JOB_FAILED",
    });
  });
});

describe("Netlify Mux reconciliation scheduler adapter", () => {
  const originalUrl = process.env.URL;
  const originalSecret = process.env.INTERNAL_JOB_SECRET;
  const originalHealthcheckUrl = process.env.MUX_RECONCILIATION_HEALTHCHECK_URL;

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.URL = "https://takineo.example";
    process.env.INTERNAL_JOB_SECRET = "j".repeat(32);
    process.env.MUX_RECONCILIATION_HEALTHCHECK_URL =
      "https://hc-ping.example/check-123";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalUrl === undefined) delete process.env.URL;
    else process.env.URL = originalUrl;
    if (originalSecret === undefined) delete process.env.INTERNAL_JOB_SECRET;
    else process.env.INTERNAL_JOB_SECRET = originalSecret;
    if (originalHealthcheckUrl === undefined) {
      delete process.env.MUX_RECONCILIATION_HEALTHCHECK_URL;
    } else {
      process.env.MUX_RECONCILIATION_HEALTHCHECK_URL = originalHealthcheckUrl;
    }
  });

  it("is configured in Netlify to run every minute", async () => {
    const config = await readFile(join(process.cwd(), "netlify.toml"), "utf8");

    expect(config).toMatch(
      /\[functions\."mux-playback-reconciliation"\]\s+schedule\s*=\s*"\* \* \* \* \*"/,
    );
  });

  it("posts only to the secret-protected internal job", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              selected: 0,
              succeeded: 0,
              failed: 0,
              requeued: 0,
              skipped: 0,
            },
            health: healthy,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const scheduler = await import("../../../netlify/functions/mux-playback-reconciliation.mjs");


    await scheduler.default(
      new Request("https://scheduler.invalid", {
        method: "POST",
        body: JSON.stringify({ next_run: "2026-08-14T10:31:00.000Z" }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((fetchMock.mock.calls[0]?.[0] as URL).toString()).toBe(
      "https://hc-ping.example/check-123/start",
    );
    const [url, init] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://takineo.example/api/internal/jobs/mux-playback-reconciliation",
    );
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      body: JSON.stringify({ limit: 10 }),
    });
    expect(new Headers(init.headers).get("x-takineo-job-secret")).toBe(
      "j".repeat(32),
    );
    expect((fetchMock.mock.calls[2]?.[0] as URL).toString()).toBe(
      "https://hc-ping.example/check-123",
    );
    const emittedLogs = logSpy.mock.calls.flat().join("\n");
    expect(emittedLogs).not.toContain("j".repeat(32));
    expect(emittedLogs).not.toContain("check-123");
  });

  it("throws on an unhealthy job response so Netlify records a function error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            health: { ...healthy, status: "DEGRADED", overdue: 1 },
          }),
          { status: 503 },
        ),
      )
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const scheduler = await import("../../../netlify/functions/mux-playback-reconciliation.mjs");

    await expect(
      scheduler.default(
        new Request("https://scheduler.invalid", {
          method: "POST",
          body: JSON.stringify({ next_run: "2026-08-14T10:31:00.000Z" }),
        }),
      ),
    ).rejects.toThrow("Mux reconciliation job returned HTTP 503");
    expect(
      fetchMock.mock.calls.some(
        (call) => (call[0] as URL).toString() ===
          "https://hc-ping.example/check-123/fail",
      ),
    ).toBe(true);
  });

  it("keeps reconciliation running when heartbeat monitoring is temporarily unconfigured", async () => {
    delete process.env.MUX_RECONCILIATION_HEALTHCHECK_URL;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            selected: 0,
            succeeded: 0,
            failed: 0,
            requeued: 0,
            skipped: 0,
          },
          health: healthy,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const scheduler = await import(
      "../../../netlify/functions/mux-playback-reconciliation.mjs"
    );

    await scheduler.default(
      new Request("https://scheduler.invalid", {
        method: "POST",
        body: JSON.stringify({ next_run: "2026-08-14T10:31:00.000Z" }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "mux_playback_reconciliation_monitor_not_configured",
      ),
    );
  });

  it("fails closed when the production runtime secret is absent", async () => {
    delete process.env.INTERNAL_JOB_SECRET;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const scheduler = await import("../../../netlify/functions/mux-playback-reconciliation.mjs");

    await expect(
      scheduler.default(
        new Request("https://scheduler.invalid", {
          method: "POST",
          body: JSON.stringify({ next_run: "2026-08-14T10:31:00.000Z" }),
        }),
      ),
    ).rejects.toThrow("INTERNAL_JOB_SECRET is required");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
