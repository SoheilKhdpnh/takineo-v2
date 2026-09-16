/**
 * Operator probe: real whisper-cli + llama-cli against workstation weights.
 * Not a unit test. Weights and binaries stay outside the git worktree.
 *
 * WAVE4_PROBE_SKIP_WHISPER=1 reuses D:\takineo-models\audio\tracks.json
 * from a prior successful transcription.
 */
import { readFile } from "node:fs/promises";

import { createHash } from "node:crypto";

import {
  assembleSessionAnalysis,
  type EngineTrackTranscript,
} from "@/lib/domain/session-analysis";
import { REVIEW_FIXTURE_POLICY } from "@/lib/session-analysis/fixture";
import { createLlamaCppAnalysisEngine } from "@/lib/session-analysis/llama-cpp";
import { createWhisperCppTranscriptionEngine } from "@/lib/session-analysis/whisper-cpp";

const STUDENT_WAV = "D:\\takineo-models\\audio\\student.wav";
const TEACHER_WAV = "D:\\takineo-models\\audio\\teacher.wav";
const TRACKS_JSON = "D:\\takineo-models\\audio\\tracks.json";

function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function transcribeTracks(): Promise<EngineTrackTranscript[]> {
  if (process.env.WAVE4_PROBE_SKIP_WHISPER === "1") {
    return JSON.parse(await readFile(TRACKS_JSON, "utf8")) as EngineTrackTranscript[];
  }

  const studentAudio = await readFile(STUDENT_WAV);
  const teacherAudio = await readFile(TEACHER_WAV);
  const transcription = createWhisperCppTranscriptionEngine({
    config: {
      whisperBin: "D:\\takineo-models\\bin\\whisper\\Release\\whisper-cli.exe",
      whisperModelPath:
        "D:\\takineo-models\\whisper-large-v3-turbo\\ggml-large-v3-turbo.bin",
      whisperModelId: "large-v3-turbo",
      whisperTimeoutMs: 600_000,
    },
  });

  console.log("=== transcribe student ===");
  const studentTrack = await transcription.transcribe({
    contentSha256: sha256Hex(studentAudio),
    participantRole: "STUDENT",
    audio: studentAudio,
  });
  console.log(JSON.stringify(studentTrack, null, 2));

  console.log("=== transcribe teacher ===");
  const teacherTrack = await transcription.transcribe({
    contentSha256: sha256Hex(teacherAudio),
    participantRole: "TEACHER",
    audio: teacherAudio,
  });
  console.log(JSON.stringify(teacherTrack, null, 2));
  return [studentTrack, teacherTrack];
}

async function main() {
  const tracks = await transcribeTracks();
  const analysis = createLlamaCppAnalysisEngine({
    config: {
      llamaBin: "D:\\takineo-models\\bin\\llama\\llama-cli.exe",
      llamaModelPath:
        "D:\\takineo-models\\qwen2.5-7b-instruct-q4_k_m\\qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf",
      llamaModelId: "Qwen2.5-7B-Instruct-Q4_K_M",
      llamaTimeoutMs: 1_200_000,
      llamaNCtx: 4096,
      llamaNGpuLayers: 0,
      llamaNPredict: 900,
      llamaTemperature: 0.1,
    },
  });

  console.log("=== analyze ===");
  const engine = await analysis.analyze({
    contentSha256: tracks[0]?.source.contentSha256 ?? "",
    tracks,
    declaredStudentLevel: "A2",
  });
  console.log(JSON.stringify(engine, null, 2));

  const assembled = assembleSessionAnalysis({
    tracks,
    engine,
    policy: REVIEW_FIXTURE_POLICY,
    declaredStudentLevel: "A2",
    teacherAudioPresent: true,
    studentAudioDurationMs: 12_000,
  });
  console.log("=== assembled ===");
  console.log(
    JSON.stringify(
      {
        degradations: assembled.degradations,
        weakPoints: assembled.weakPoints,
        corrections: assembled.corrections.map((item) => ({
          type: item.type,
          subtype: item.subtype,
          originalText: item.originalText,
          correctedText: item.correctedText,
        })),
        summaryEn: assembled.summaryEn,
        overallLevelEstimate: assembled.overallLevelEstimate,
      },
      null,
      2,
    ),
  );
}

await main();
