import {
  reviewFixtureEngineOutput,
  reviewFixtureTracks,
  REVIEW_STUDENT_SHA256,
  REVIEW_TEACHER_SHA256,
} from "@/lib/session-analysis/fixture";
import type {
  AnalysisEnginePort,
  TranscriptionEnginePort,
} from "@/lib/session-analysis/ports";

export type {
  AnalysisEnginePort,
  AudioStoragePort,
  TranscriptionEnginePort,
} from "@/lib/session-analysis/ports";

export function createFakeTranscriptionEngine(options?: {
  studentConfidence?: number;
}): TranscriptionEnginePort {
  return {
    async transcribe({ contentSha256, participantRole }) {
      const tracks = reviewFixtureTracks();
      const track = tracks.find((item) => item.participantRole === participantRole);
      if (!track) {
        throw new Error(`No fixture track for ${participantRole}.`);
      }

      const expected =
        participantRole === "STUDENT" ? REVIEW_STUDENT_SHA256 : REVIEW_TEACHER_SHA256;
      if (contentSha256 !== expected) {
        throw new Error("Unknown fixture checksum.");
      }

      if (options?.studentConfidence !== undefined && participantRole === "STUDENT") {
        return {
          ...track,
          segments: track.segments.map((segment) => ({
            ...segment,
            confidence: options.studentConfidence ?? segment.confidence,
          })),
        };
      }

      return track;
    },
  };
}

export function createFakeAnalysisEngine(options?: {
  fail?: boolean;
  malformed?: boolean;
}): AnalysisEnginePort {
  return {
    async analyze() {
      if (options?.fail) {
        throw new Error("ANALYSIS_ENGINE_UNAVAILABLE");
      }
      if (options?.malformed) {
        return {
          ...reviewFixtureEngineOutput(),
          corrections: [
            {
              type: "GRAMMAR_ERROR",
              subtype: "PAST_SIMPLE",
              originalText: "this was never said",
              correctedText: "something else",
              explanation: "ungrounded",
              transcriptSegmentIndex: 0,
              charStart: null,
              charEnd: null,
              confidence: 0.9,
            },
          ],
        };
      }
      return reviewFixtureEngineOutput();
    },
  };
}
