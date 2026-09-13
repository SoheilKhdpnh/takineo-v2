import type {
  AudioParticipantRole,
  SessionTranscript,
  TranscriptSegment,
  TranscriptSource,
} from "./types";

export type EngineTrackTranscript = {
  participantRole: AudioParticipantRole;
  language: string;
  segments: Array<{
    startMs: number;
    endMs: number;
    text: string;
    confidence: number | null;
  }>;
  source: TranscriptSource;
};

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0).length;
}

function speakingMs(segments: TranscriptSegment[], role: AudioParticipantRole): number {
  return segments
    .filter((segment) => segment.speaker === role)
    .reduce((sum, segment) => sum + (segment.endMs - segment.startMs), 0);
}

function meanConfidence(segments: TranscriptSegment[]): number | null {
  const student = segments.filter(
    (segment) => segment.speaker === "STUDENT" && segment.confidence !== null,
  );
  if (student.length === 0) {
    return null;
  }
  const total = student.reduce((sum, segment) => sum + (segment.confidence ?? 0), 0);
  return total / student.length;
}

export function mergeTrackTranscripts(
  tracks: EngineTrackTranscript[],
): SessionTranscript {
  if (tracks.length === 0) {
    throw new RangeError("At least one track transcript is required.");
  }

  const raw: Omit<TranscriptSegment, "index">[] = [];
  for (const track of tracks) {
    for (const segment of track.segments) {
      if (!Number.isInteger(segment.startMs) || !Number.isInteger(segment.endMs)) {
        throw new RangeError("Transcript segment times must be integers.");
      }
      if (segment.endMs <= segment.startMs) {
        throw new RangeError("Transcript segment endMs must be greater than startMs.");
      }
      raw.push({
        speaker: track.participantRole,
        startMs: segment.startMs,
        endMs: segment.endMs,
        text: segment.text,
        confidence: segment.confidence,
      });
    }
  }

  raw.sort((left, right) => {
    if (left.startMs !== right.startMs) {
      return left.startMs - right.startMs;
    }
    if (left.speaker !== right.speaker) {
      return left.speaker === "STUDENT" ? -1 : 1;
    }
    return left.endMs - right.endMs;
  });

  const segments = raw.map((segment, index) => ({ ...segment, index }));
  const hasTeacher = tracks.some((track) => track.participantRole === "TEACHER");
  const studentSegments = segments.filter((segment) => segment.speaker === "STUDENT");
  const teacherSegments = segments.filter((segment) => segment.speaker === "TEACHER");

  return {
    schemaVersion: 1,
    language: tracks[0]?.language ?? "en",
    segments,
    studentWordCount: studentSegments.reduce(
      (sum, segment) => sum + countWords(segment.text),
      0,
    ),
    teacherWordCount: hasTeacher
      ? teacherSegments.reduce((sum, segment) => sum + countWords(segment.text), 0)
      : null,
    studentSpeakingMs: speakingMs(segments, "STUDENT"),
    teacherSpeakingMs: hasTeacher ? speakingMs(segments, "TEACHER") : null,
    meanStudentConfidence: meanConfidence(segments),
    sources: tracks.map((track) => track.source),
  };
}

export function normalizeComparableText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function segmentContainsSpan(
  segmentText: string,
  originalText: string,
): boolean {
  return normalizeComparableText(segmentText).includes(
    normalizeComparableText(originalText),
  );
}
