import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  getInternalJobSecret: vi.fn(),
  processDueLiveSessionCompletions: vi.fn(),
}));

vi.mock("@/lib/env/internal-jobs", () => ({
  getInternalJobSecret: mocks.getInternalJobSecret,
}));

vi.mock("@/lib/services/live-session-completion.service", () => ({
  processDueLiveSessionCompletions: mocks.processDueLiveSessionCompletions,
}));

import {
  dynamic,
  POST as runCompletionJob,
} from "@/app/api/internal/jobs/live-session-completion/route";

function request(
  secret = "s".repeat(32),
  body: unknown = { limit: 10 },
) {
  return new Request(
    "http://localhost:3000/api/internal/jobs/live-session-completion",
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

describe("live-session completion internal job route", () => {
  beforeEach(() => {
    mocks.getInternalJobSecret.mockReturnValue("s".repeat(32));
    mocks.processDueLiveSessionCompletions.mockResolvedValue({
      selected: 1,
      completed: 1,
      skipped: 0,
      failed: 0,
    });
  });

  it("is explicitly dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("denies a missing scheduler secret before doing work", async () => {
    const response = await runCompletionJob(
      new Request(
        "http://localhost:3000/api/internal/jobs/live-session-completion",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ limit: 10 }),
        },
      ),
    );

    expect(response.status).toBe(401);
    expect(mocks.processDueLiveSessionCompletions).not.toHaveBeenCalled();
  });

  it("runs the completion job for a trusted scheduler", async () => {
    const response = await runCompletionJob(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      selected: 1,
      completed: 1,
      skipped: 0,
      failed: 0,
    });
  });
});
