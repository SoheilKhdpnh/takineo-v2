import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getInternalJobSecret: vi.fn(),
  getSessionAnalysisPolicy: vi.fn(),
  analyzeCompletedSession: vi.fn(),
  createSessionAnalysisEngines: vi.fn(),
}));

vi.mock("@/lib/env/internal-jobs", () => ({
  getInternalJobSecret: mocks.getInternalJobSecret,
}));

vi.mock("@/lib/env/session-analysis", () => ({
  getSessionAnalysisPolicy: mocks.getSessionAnalysisPolicy,
}));

vi.mock("@/lib/session-analysis/engines", () => ({
  createSessionAnalysisEngines: mocks.createSessionAnalysisEngines,
}));

vi.mock("@/lib/services/session-analysis.service", () => ({
  analyzeCompletedSession: mocks.analyzeCompletedSession,
}));

import { POST as runSessionAnalysisJob } from "@/app/api/internal/jobs/session-analysis/route";
import { REVIEW_FIXTURE_POLICY } from "@/lib/session-analysis/fixture";

function request(secret?: string, body: unknown = { sessionId: "session-1" }) {
  const headers = new Headers({ "content-type": "application/json" });
  if (secret) {
    headers.set("x-takineo-job-secret", secret);
  }
  return new Request("http://localhost:3000/api/internal/jobs/session-analysis", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("session analysis internal job route", () => {
  beforeEach(() => {
    mocks.getInternalJobSecret.mockReset();
    mocks.getSessionAnalysisPolicy.mockReset();
    mocks.analyzeCompletedSession.mockReset();
    mocks.createSessionAnalysisEngines.mockReset();
    mocks.getInternalJobSecret.mockReturnValue("s".repeat(32));
    mocks.getSessionAnalysisPolicy.mockReturnValue(REVIEW_FIXTURE_POLICY);
    mocks.createSessionAnalysisEngines.mockReturnValue({
      transcription: { transcribe: vi.fn() },
      analysis: { analyze: vi.fn() },
      storage: { head: vi.fn(), openReadStream: vi.fn(), delete: vi.fn() },
    });
    mocks.analyzeCompletedSession.mockResolvedValue({
      degradations: [],
      weakPoints: [{ subtype: "PAST_SIMPLE" }],
      corrections: [{ type: "GRAMMAR_ERROR" }],
    });
  });

  it("rejects a missing secret", async () => {
    const response = await runSessionAnalysisJob(request());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "INTERNAL_JOB_UNAUTHORIZED",
    });
    expect(mocks.analyzeCompletedSession).not.toHaveBeenCalled();
  });

  it("reports not-configured when the secret is unset", async () => {
    mocks.getInternalJobSecret.mockImplementation(() => {
      throw new Error("missing");
    });
    const response = await runSessionAnalysisJob(request("s".repeat(32)));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "INTERNAL_JOB_NOT_CONFIGURED",
    });
  });

  it("swaps the real engine adapters into the session-analysis job", async () => {
    const engines = {
      transcription: { transcribe: vi.fn() },
      analysis: { analyze: vi.fn() },
      storage: { head: vi.fn(), openReadStream: vi.fn(), delete: vi.fn() },
    };
    mocks.createSessionAnalysisEngines.mockReturnValue(engines);
    const response = await runSessionAnalysisJob(request("s".repeat(32)));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      degradations: [],
      weakPointCount: 1,
      correctionCount: 1,
    });
    expect(mocks.analyzeCompletedSession).toHaveBeenCalledWith(
      expect.objectContaining({
        transcription: engines.transcription,
        analysis: engines.analysis,
        storage: engines.storage,
      }),
    );
  });
});
