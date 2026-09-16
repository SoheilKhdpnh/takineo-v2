import "server-only";

import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { SessionAnalysisEngineError } from "@/lib/errors/session-analysis-errors";
import { sha256Hex } from "@/lib/session-analysis/audio-integrity";
import { extractJsonObject } from "@/lib/session-analysis/json-extract";
import type { SessionAnalysisEngineConfig } from "@/lib/env/session-analysis-engines";
import type { EngineTrackTranscript } from "@/lib/domain/session-analysis";
import {
  CommandTimedOutError,
  runCommand,
  type ProcessRunner,
} from "@/lib/session-analysis/process-runner";
import type { TranscriptionEnginePort } from "@/lib/session-analysis/ports";

type WhisperSegment = {
  startMs: number;
  endMs: number;
  text: string;
  confidence: number | null;
};

export function createWhisperCppTranscriptionEngine(input: {
  config: Pick<
    SessionAnalysisEngineConfig,
    "whisperBin" | "whisperModelPath" | "whisperModelId" | "whisperTimeoutMs"
  >;
  runner?: ProcessRunner;
}): TranscriptionEnginePort {
  const runner = input.runner ?? runCommand;
  const paramsHash = createHash("sha256")
    .update(
      JSON.stringify({
        engine: "whisper.cpp",
        model: input.config.whisperModelId,
        language: "en",
        output: "json",
      }),
    )
    .digest("hex");

  return {
    async transcribe({ contentSha256, participantRole, audio }) {
      if (sha256Hex(audio) !== contentSha256) {
        throw new SessionAnalysisEngineError("AUDIO_UNREADABLE");
      }

      const workDir = await mkdtemp(path.join(tmpdir(), "takineo-whisper-"));
      const audioPath = path.join(workDir, "track.wav");
      const outputPrefix = path.join(workDir, "transcript");
      try {
        await writeFile(audioPath, audio);
        let result;
        try {
          result = await runner({
            command: input.config.whisperBin,
            args: [
              "-m",
              input.config.whisperModelPath,
              "-f",
              audioPath,
              "-l",
              "en",
              "-oj",
              "-of",
              outputPrefix,
            ],
            timeoutMs: input.config.whisperTimeoutMs,
            cwd: workDir,
          });
        } catch (error) {
          if (error instanceof CommandTimedOutError) {
            throw new SessionAnalysisEngineError("TRANSCRIPTION_TIMEOUT");
          }
          throw new SessionAnalysisEngineError("TRANSCRIPTION_ENGINE_UNAVAILABLE");
        }

        if (result.exitCode !== 0) {
          throw new SessionAnalysisEngineError("TRANSCRIPTION_ENGINE_UNAVAILABLE");
        }

        const raw = await readFile(`${outputPrefix}.json`, "utf8").catch(() => result.stdout);
        let segments;
        try {
          segments = parseWhisperTranscript(raw);
        } catch (error) {
          if (error instanceof SessionAnalysisEngineError) {
            throw error;
          }
          throw new SessionAnalysisEngineError("TRANSCRIPTION_ENGINE_UNAVAILABLE");
        }
        if (segments.length === 0) {
          throw new SessionAnalysisEngineError("TRANSCRIPT_EMPTY");
        }

        const track: EngineTrackTranscript = {
          participantRole,
          language: "en",
          segments,
          source: {
            participantRole,
            contentSha256,
            engine: "whisper.cpp",
            model: input.config.whisperModelId,
            paramsHash,
          },
        };
        return track;
      } finally {
        await rm(workDir, { recursive: true, force: true });
      }
    },
  };
}

export function parseWhisperTranscript(raw: string): WhisperSegment[] {
  const payload = extractJsonObject(raw) as {
    transcription?: unknown;
  };
  if (!Array.isArray(payload.transcription)) {
    throw new SessionAnalysisEngineError("TRANSCRIPT_EMPTY");
  }

  const segments: WhisperSegment[] = [];
  for (const item of payload.transcription) {
    const parsed = parseWhisperSegment(item);
    if (parsed) {
      segments.push(parsed);
    }
  }
  return segments;
}

function parseWhisperSegment(item: unknown): WhisperSegment | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const record = item as {
    text?: unknown;
    offsets?: { from?: unknown; to?: unknown };
    timestamps?: { from?: unknown; to?: unknown };
    tokens?: unknown;
  };
  const text = typeof record.text === "string" ? record.text.trim() : "";
  if (!text) {
    return null;
  }
  const startMs = readOffsetMs(record.offsets?.from) ?? parseTimestampMs(record.timestamps?.from);
  const endMs = readOffsetMs(record.offsets?.to) ?? parseTimestampMs(record.timestamps?.to);
  if (startMs === null || endMs === null || endMs <= startMs) {
    return null;
  }
  return {
    startMs,
    endMs,
    text,
    confidence: meanTokenConfidence(record.tokens),
  };
}

function readOffsetMs(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function parseTimestampMs(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = /^(\d+):(\d{2}):(\d{2})[,.](\d{3})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = Number(match[4]);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
}

function meanTokenConfidence(tokens: unknown): number | null {
  if (!Array.isArray(tokens)) {
    return null;
  }
  const probs = tokens
    .map((token) =>
      token && typeof token === "object" && typeof (token as { p?: unknown }).p === "number"
        ? (token as { p: number }).p
        : null,
    )
    .filter((value): value is number => value !== null && value >= 0 && value <= 1);
  if (probs.length === 0) {
    return null;
  }
  return probs.reduce((sum, value) => sum + value, 0) / probs.length;
}
