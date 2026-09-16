import { writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { SessionAnalysisEngineError } from "@/lib/errors/session-analysis-errors";
import {
  REVIEW_STUDENT_SHA256,
  REVIEW_STUDENT_WAV,
} from "@/lib/session-analysis/fixture";
import {
  createWhisperCppTranscriptionEngine,
  parseWhisperTranscript,
} from "@/lib/session-analysis/whisper-cpp";
import { CommandTimedOutError } from "@/lib/session-analysis/process-runner";

const whisperConfig = {
  whisperBin: "whisper-cli",
  whisperModelPath: "/models/ggml-large-v3-turbo.bin",
  whisperModelId: "large-v3-turbo",
  whisperTimeoutMs: 30_000,
};

const whisperJson = {
  transcription: [
    {
      offsets: { from: 1240, to: 6000 },
      text: " Yesterday I go to the university.",
      tokens: [{ p: 0.9 }, { p: 0.7 }],
    },
  ],
};

describe("whisper.cpp transcription adapter", () => {
  it("parses offsets, trimmed text, and mean token confidence", () => {
    const segments = parseWhisperTranscript(JSON.stringify(whisperJson));
    expect(segments).toEqual([
      {
        startMs: 1240,
        endMs: 6000,
        text: "Yesterday I go to the university.",
        confidence: 0.8,
      },
    ]);
  });

  it("transcribes verified bytes through whisper-cli JSON output", async () => {
    const engine = createWhisperCppTranscriptionEngine({
      config: whisperConfig,
      runner: async ({ args }) => {
        const prefix = args[args.indexOf("-of") + 1];
        await writeFile(`${prefix}.json`, JSON.stringify(whisperJson));
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    const track = await engine.transcribe({
      contentSha256: REVIEW_STUDENT_SHA256,
      participantRole: "STUDENT",
      audio: REVIEW_STUDENT_WAV,
    });

    expect(track.source).toMatchObject({
      engine: "whisper.cpp",
      model: "large-v3-turbo",
      contentSha256: REVIEW_STUDENT_SHA256,
    });
    expect(track.segments[0]?.text).toBe("Yesterday I go to the university.");
  });

  it("rejects audio whose bytes do not match the claimed checksum", async () => {
    const engine = createWhisperCppTranscriptionEngine({
      config: whisperConfig,
      runner: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    });

    await expect(
      engine.transcribe({
        contentSha256: "a".repeat(64),
        participantRole: "STUDENT",
        audio: REVIEW_STUDENT_WAV,
      }),
    ).rejects.toMatchObject({ code: "AUDIO_UNREADABLE" });
  });

  it("maps a subprocess timeout to TRANSCRIPTION_TIMEOUT", async () => {
    const engine = createWhisperCppTranscriptionEngine({
      config: whisperConfig,
      runner: async () => {
        throw new CommandTimedOutError(30_000);
      },
    });

    await expect(
      engine.transcribe({
        contentSha256: REVIEW_STUDENT_SHA256,
        participantRole: "STUDENT",
        audio: REVIEW_STUDENT_WAV,
      }),
    ).rejects.toBeInstanceOf(SessionAnalysisEngineError);
    await expect(
      engine.transcribe({
        contentSha256: REVIEW_STUDENT_SHA256,
        participantRole: "STUDENT",
        audio: REVIEW_STUDENT_WAV,
      }),
    ).rejects.toMatchObject({ code: "TRANSCRIPTION_TIMEOUT" });
  });
});
