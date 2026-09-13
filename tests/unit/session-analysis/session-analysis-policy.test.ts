import { afterEach, describe, expect, it } from "vitest";

import { getSessionAnalysisPolicy } from "@/lib/env/session-analysis";

const KEYS = [
  "SESSION_ANALYSIS_MIN_DURATION_MS",
  "SESSION_ANALYSIS_MAX_DURATION_MS",
  "SESSION_ANALYSIS_CONFIDENCE_THRESHOLD",
  "SESSION_ANALYSIS_OVERUSE_THRESHOLD",
  "SESSION_ANALYSIS_WEAK_POINT_MIN_OCCURRENCES",
  "SESSION_ANALYSIS_OPTIONAL_IMPROVEMENT_CAP",
  "SESSION_ANALYSIS_GENERAL_SUGGESTION_CAP",
  "SESSION_ANALYSIS_LONG_PAUSE_MS",
  "SESSION_ANALYSIS_MAX_ATTEMPTS",
] as const;

const valid: Record<(typeof KEYS)[number], string> = {
  SESSION_ANALYSIS_MIN_DURATION_MS: "1000",
  SESSION_ANALYSIS_MAX_DURATION_MS: "1200000",
  SESSION_ANALYSIS_CONFIDENCE_THRESHOLD: "0.5",
  SESSION_ANALYSIS_OVERUSE_THRESHOLD: "3",
  SESSION_ANALYSIS_WEAK_POINT_MIN_OCCURRENCES: "2",
  SESSION_ANALYSIS_OPTIONAL_IMPROVEMENT_CAP: "1",
  SESSION_ANALYSIS_GENERAL_SUGGESTION_CAP: "1",
  SESSION_ANALYSIS_LONG_PAUSE_MS: "1500",
  SESSION_ANALYSIS_MAX_ATTEMPTS: "3",
};

describe("session analysis policy", () => {
  afterEach(() => {
    for (const key of KEYS) {
      delete process.env[key];
    }
  });

  it("reads a fully configured policy", () => {
    Object.assign(process.env, valid);
    expect(getSessionAnalysisPolicy().weakPointMinimumOccurrences).toBe(2);
  });

  it.each(KEYS)("fails closed when %s is absent", (key) => {
    Object.assign(process.env, valid);
    delete process.env[key];
    expect(() => getSessionAnalysisPolicy()).toThrow(/is not configured/);
  });
});
