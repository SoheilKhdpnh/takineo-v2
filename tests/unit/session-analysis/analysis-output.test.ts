import { describe, expect, it } from "vitest";

import { extractJsonObject } from "@/lib/session-analysis/json-extract";
import { parseAnalysisEngineOutput } from "@/lib/session-analysis/analysis-output";

describe("analysis engine JSON", () => {
  it("extracts a fenced JSON object", () => {
    expect(
      extractJsonObject('```json\n{"overallLevelEstimate":"A2","summaryEn":"ok","corrections":[]}\n```'),
    ).toMatchObject({ overallLevelEstimate: "A2" });
  });

  it("rejects output missing required summary text", () => {
    expect(() =>
      parseAnalysisEngineOutput({
        overallLevelEstimate: "A2",
        corrections: [],
      }),
    ).toThrow(/did not match the contract schema/);
  });
});
