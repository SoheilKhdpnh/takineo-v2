import type {
  SessionAnalysisPolicy,
  SessionFluencyProfile,
  SessionTranscript,
} from "./types";

const FILLER_PATTERN =
  /\b(um+|uh+|er+|ah+|like|you know|i mean|kind of|sort of)\b/gi;

function countFillers(text: string): number {
  return [...text.matchAll(FILLER_PATTERN)].length;
}

function distinctWords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z'\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean),
    ),
  ];
}

/**
 * A student pause is silence in the student timeline that is not covered by
 * teacher speech. Teacher floor time is conversation, not disfluency.
 */
export function measureStudentPauses(
  transcript: SessionTranscript,
  longPauseMs: number,
): { durationsMs: number[]; longPauseCount: number } {
  const student = transcript.segments
    .filter((segment) => segment.speaker === "STUDENT")
    .sort((left, right) => left.startMs - right.startMs);

  const durationsMs: number[] = [];

  for (let index = 1; index < student.length; index += 1) {
    const gapStart = student[index - 1].endMs;
    const gapEnd = student[index].startMs;
    if (gapEnd <= gapStart) {
      continue;
    }

    const teacherCoverage = transcript.segments
      .filter((segment) => segment.speaker === "TEACHER")
      .reduce((covered, segment) => {
        const overlapStart = Math.max(gapStart, segment.startMs);
        const overlapEnd = Math.min(gapEnd, segment.endMs);
        return covered + Math.max(0, overlapEnd - overlapStart);
      }, 0);

    const pauseMs = gapEnd - gapStart - teacherCoverage;
    if (pauseMs > 0) {
      durationsMs.push(pauseMs);
    }
  }

  return {
    durationsMs,
    longPauseCount: durationsMs.filter((duration) => duration >= longPauseMs).length,
  };
}

export function buildFluencyProfile(
  transcript: SessionTranscript,
  policy: SessionAnalysisPolicy,
  extras: {
    selfCorrectionCount: number;
    repetitionCount: number;
    abandonedSentenceCount: number;
    teacherAudioPresent: boolean;
  },
): SessionFluencyProfile {
  const studentText = transcript.segments
    .filter((segment) => segment.speaker === "STUDENT")
    .map((segment) => segment.text)
    .join(" ");
  const pauses = measureStudentPauses(transcript, policy.longPauseMs);
  const speakingMinutes = transcript.studentSpeakingMs / 60_000;
  const wordsPerMinute =
    speakingMinutes > 0 ? transcript.studentWordCount / speakingMinutes : 0;
  const fillerWordCount = countFillers(studentText);
  const distinct = distinctWords(studentText);
  const teacherAudioPresent = extras.teacherAudioPresent;

  const studentTurns = transcript.segments.filter(
    (segment) => segment.speaker === "STUDENT",
  );
  const turnDurations = studentTurns.map((segment) => segment.endMs - segment.startMs);

  const narrativeParts = [
    `You spoke for ${Math.round(transcript.studentSpeakingMs / 1000)} seconds and used ${transcript.studentWordCount} words.`,
  ];
  if (fillerWordCount > 0) {
    narrativeParts.push(
      `Filler language appeared ${fillerWordCount} time${fillerWordCount === 1 ? "" : "s"}.`,
    );
  }
  if (pauses.longPauseCount > 0) {
    narrativeParts.push(
      `There were ${pauses.longPauseCount} long pause${pauses.longPauseCount === 1 ? "" : "s"} while you held the floor.`,
    );
  }

  return {
    provenance: "AI_OBSERVATION",
    studentSpeakingMs: transcript.studentSpeakingMs,
    studentWordCount: transcript.studentWordCount,
    studentWordsPerMinute: wordsPerMinute,
    studentSpeakingRatio:
      teacherAudioPresent &&
      transcript.teacherSpeakingMs !== null &&
      transcript.studentSpeakingMs + transcript.teacherSpeakingMs > 0
        ? transcript.studentSpeakingMs /
          (transcript.studentSpeakingMs + transcript.teacherSpeakingMs)
        : null,
    pauseCount: pauses.durationsMs.length,
    longPauseCount: pauses.longPauseCount,
    meanPauseMs:
      pauses.durationsMs.length > 0
        ? Math.round(
            pauses.durationsMs.reduce((sum, value) => sum + value, 0) /
              pauses.durationsMs.length,
          )
        : null,
    longestPauseMs:
      pauses.durationsMs.length > 0 ? Math.max(...pauses.durationsMs) : null,
    fillerWordCount,
    fillerWordRate:
      transcript.studentWordCount > 0
        ? (fillerWordCount / transcript.studentWordCount) * 100
        : 0,
    selfCorrectionCount: extras.selfCorrectionCount,
    repetitionCount: extras.repetitionCount,
    abandonedSentenceCount: extras.abandonedSentenceCount,
    turnCount: teacherAudioPresent ? studentTurns.length : null,
    meanStudentTurnMs:
      teacherAudioPresent && turnDurations.length > 0
        ? Math.round(
            turnDurations.reduce((sum, value) => sum + value, 0) / turnDurations.length,
          )
        : null,
    longestStudentTurnMs:
      teacherAudioPresent && turnDurations.length > 0
        ? Math.max(...turnDurations)
        : null,
    distinctWordCount: distinct.length,
    typeTokenRatio:
      transcript.studentWordCount > 0
        ? distinct.length / transcript.studentWordCount
        : null,
    narrativeFeedbackEn: narrativeParts.join(" "),
    narrativeFeedbackFa: null,
  };
}

export function bandConfidence(confidence: number): "LOW" | "MEDIUM" | "HIGH" {
  if (confidence >= 0.8) {
    return "HIGH";
  }
  if (confidence >= 0.55) {
    return "MEDIUM";
  }
  return "LOW";
}
