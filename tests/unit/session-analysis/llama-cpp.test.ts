import { describe, expect, it } from "vitest";

import { SessionAnalysisEngineError } from "@/lib/errors/session-analysis-errors";
import { reviewFixtureTracks } from "@/lib/session-analysis/fixture";
import { createLlamaCppAnalysisEngine } from "@/lib/session-analysis/llama-cpp";
import { CommandTimedOutError } from "@/lib/session-analysis/process-runner";

const llamaConfig = {
  llamaBin: "llama-cli",
  llamaModelPath:
    "/models/qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf",
  llamaModelId: "Qwen2.5-7B-Instruct-Q4_K_M",
  llamaTimeoutMs: 60_000,
  llamaNCtx: 4096,
  llamaNGpuLayers: 0,
  llamaNPredict: 900,
  llamaTemperature: 0.1,
};

const validOutput = {
  overallLevelEstimate: "A2",
  summaryEn: "The student used present forms for a past visit.",
  corrections: [
    {
      type: "GRAMMAR_ERROR",
      subtype: "PAST_SIMPLE",
      originalText: "I go",
      correctedText: "I went",
      explanation: "Yesterday requires the past form.",
      transcriptSegmentIndex: 0,
      charStart: 10,
      charEnd: 14,
      confidence: 0.93,
    },
  ],
};

describe("llama.cpp analysis adapter", () => {
  it("parses JSON from noisy llama-cli stdout and passes tracks into the prompt", async () => {
    let capturedPrompt = "";
    const engine = createLlamaCppAnalysisEngine({
      config: llamaConfig,
      runner: async ({ args }) => {
        capturedPrompt = args[args.indexOf("-p") + 1] ?? "";
        expect(args).toContain("-ngl");
        expect(args[args.indexOf("-ngl") + 1]).toBe("0");
        expect(args).toContain("-st");
        expect(args).toContain("--simple-io");
        return {
          stdout: `load time = 12ms\n${JSON.stringify(validOutput)}\nllama_print_timings: done`,
          stderr: "",
          exitCode: 0,
        };
      },
    });

    const output = await engine.analyze({
      contentSha256: "a".repeat(64),
      tracks: reviewFixtureTracks(),
      declaredStudentLevel: "A2",
    });

    expect(output.overallLevelEstimate).toBe("A2");
    expect(output.corrections).toHaveLength(1);
    expect(output.vocabulary).toEqual([]);
    expect(capturedPrompt).toContain("Yesterday I go to the university");
    expect(capturedPrompt).toContain("The student working level is A2");
    expect(capturedPrompt).toContain("[1] TEACHER:");
  });

  it("maps invalid JSON to ANALYSIS_OUTPUT_INVALID", async () => {
    const engine = createLlamaCppAnalysisEngine({
      config: llamaConfig,
      runner: async () => ({ stdout: "not json", stderr: "", exitCode: 0 }),
    });

    await expect(
      engine.analyze({
        contentSha256: "a".repeat(64),
        tracks: reviewFixtureTracks(),
        declaredStudentLevel: null,
      }),
    ).rejects.toMatchObject({ code: "ANALYSIS_OUTPUT_INVALID" });
  });

  it("maps a subprocess timeout to ANALYSIS_TIMEOUT", async () => {
    const engine = createLlamaCppAnalysisEngine({
      config: llamaConfig,
      runner: async () => {
        throw new CommandTimedOutError(60_000);
      },
    });

    await expect(
      engine.analyze({
        contentSha256: "a".repeat(64),
        tracks: reviewFixtureTracks(),
        declaredStudentLevel: "A2",
      }),
    ).rejects.toBeInstanceOf(SessionAnalysisEngineError);
    await expect(
      engine.analyze({
        contentSha256: "a".repeat(64),
        tracks: reviewFixtureTracks(),
        declaredStudentLevel: "A2",
      }),
    ).rejects.toMatchObject({ code: "ANALYSIS_TIMEOUT" });
  });
});
