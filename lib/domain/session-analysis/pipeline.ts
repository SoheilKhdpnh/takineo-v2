import { acceptCorrections } from "./corrections";
import { buildFluencyProfile } from "./fluency";
import { resolveStudentWorkingLevel } from "./level-gating";
import { acceptSuggestions, type ProposedSuggestion } from "./suggestions";
import {
  mergeTrackTranscripts,
  type EngineTrackTranscript,
} from "./transcript";
import type {
  AnalysisDegradation,
  EnglishLevel,
  ProposedCorrection,
  ProposedVocabularyObservation,
  SessionAnalysisAssembly,
  SessionAnalysisPolicy,
} from "./types";
import { acceptVocabularyObservations } from "./vocabulary";
import { aggregateWeakPoints } from "./weak-points";

export type AnalysisEngineOutput = {
  overallLevelEstimate: EnglishLevel | null;
  corrections: ProposedCorrection[];
  vocabulary: ProposedVocabularyObservation[];
  suggestions: ProposedSuggestion[];
  selfCorrectionCount: number;
  repetitionCount: number;
  abandonedSentenceCount: number;
  summaryEn: string;
  summaryFa: string | null;
};

export function assembleSessionAnalysis(input: {
  tracks: EngineTrackTranscript[];
  engine: AnalysisEngineOutput;
  policy: SessionAnalysisPolicy;
  declaredStudentLevel: EnglishLevel | null;
  teacherAudioPresent: boolean;
  studentAudioDurationMs: number;
}): SessionAnalysisAssembly {
  const transcript = mergeTrackTranscripts(input.tracks);
  const degradations: AnalysisDegradation[] = [];

  if (!input.teacherAudioPresent) {
    degradations.push("TEACHER_AUDIO_MISSING");
  }

  if (
    transcript.meanStudentConfidence !== null &&
    transcript.meanStudentConfidence < input.policy.confidenceThreshold
  ) {
    degradations.push("LOW_TRANSCRIPT_CONFIDENCE");
  }

  if (transcript.studentWordCount < 8) {
    degradations.push("STUDENT_SPEECH_MINIMAL");
  }

  const coveredMs = Math.max(
    0,
    ...transcript.segments.map((segment) => segment.endMs),
  );
  if (coveredMs + 2_000 < input.studentAudioDurationMs) {
    degradations.push("TRUNCATED_TRANSCRIPT");
  }

  const workingLevel = resolveStudentWorkingLevel({
    declaredLevel: input.declaredStudentLevel,
    estimatedLevel: input.engine.overallLevelEstimate,
  });
  if (!workingLevel) {
    degradations.push("STUDENT_LEVEL_UNKNOWN");
  }

  const corrections = acceptCorrections(
    input.engine.corrections,
    transcript,
    input.policy,
  );
  const vocabulary = acceptVocabularyObservations(
    input.engine.vocabulary,
    transcript,
    input.policy,
    workingLevel,
  );
  const weakPoints = aggregateWeakPoints(corrections, input.policy);
  const suggestions = acceptSuggestions(
    input.engine.suggestions,
    weakPoints,
    input.policy,
  );
  const fluency = buildFluencyProfile(transcript, input.policy, {
    selfCorrectionCount: input.engine.selfCorrectionCount,
    repetitionCount: input.engine.repetitionCount,
    abandonedSentenceCount: input.engine.abandonedSentenceCount,
    teacherAudioPresent: input.teacherAudioPresent,
  });

  return {
    transcript,
    corrections,
    vocabulary,
    fluency,
    weakPoints,
    suggestions,
    degradations,
    resolvedStudentLevel: workingLevel,
    overallLevelEstimate: input.engine.overallLevelEstimate,
    summaryEn: input.engine.summaryEn,
    summaryFa: input.engine.summaryFa,
  };
}
