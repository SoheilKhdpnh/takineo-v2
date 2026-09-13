export const ENGLISH_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type EnglishLevel = (typeof ENGLISH_LEVELS)[number];

export const SESSION_ANALYSIS_PROVENANCES = [
  "AI_OBSERVATION",
  "AI_RECOMMENDATION",
  "TEACHER_JUDGEMENT",
] as const;
export type SessionAnalysisProvenance =
  (typeof SESSION_ANALYSIS_PROVENANCES)[number];

export const AUDIO_PARTICIPANT_ROLES = ["STUDENT", "TEACHER"] as const;
export type AudioParticipantRole = (typeof AUDIO_PARTICIPANT_ROLES)[number];

export const CORRECTION_TYPES = [
  "GRAMMAR_ERROR",
  "LEXICAL_ERROR",
  "NATURALNESS",
  "OPTIONAL_IMPROVEMENT",
] as const;
export type CorrectionType = (typeof CORRECTION_TYPES)[number];

export const ERROR_CORRECTION_TYPES = [
  "GRAMMAR_ERROR",
  "LEXICAL_ERROR",
] as const;
export type ErrorCorrectionType = (typeof ERROR_CORRECTION_TYPES)[number];

export function isErrorCorrectionType(
  type: CorrectionType,
): type is ErrorCorrectionType {
  return type === "GRAMMAR_ERROR" || type === "LEXICAL_ERROR";
}

export const WEAK_POINT_CATEGORIES = [
  "GRAMMAR",
  "VOCABULARY",
  "PRONUNCIATION",
  "FLUENCY",
  "DISCOURSE",
  "TASK_RESPONSE",
] as const;
export type WeakPointCategory = (typeof WEAK_POINT_CATEGORIES)[number];

export const WEAK_POINT_SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type WeakPointSeverity = (typeof WEAK_POINT_SEVERITIES)[number];

export const SUGGESTION_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export type SuggestionPriority = (typeof SUGGESTION_PRIORITIES)[number];

export const SUGGESTION_KINDS = [
  "PRACTICE_DRILL",
  "PHRASE_SUBSTITUTION",
  "PRONUNCIATION_EXERCISE",
  "HOMEWORK_TASK",
  "RESOURCE",
] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export const ANALYSIS_DEGRADATIONS = [
  "TEACHER_AUDIO_MISSING",
  "LOW_TRANSCRIPT_CONFIDENCE",
  "STUDENT_SPEECH_MINIMAL",
  "TRUNCATED_TRANSCRIPT",
  "STUDENT_LEVEL_UNKNOWN",
] as const;
export type AnalysisDegradation = (typeof ANALYSIS_DEGRADATIONS)[number];

export const ANALYSIS_FAILURE_CODES = [
  "AUDIO_UNREADABLE",
  "AUDIO_TOO_SHORT",
  "TRANSCRIPTION_ENGINE_UNAVAILABLE",
  "TRANSCRIPTION_TIMEOUT",
  "TRANSCRIPT_EMPTY",
  "ANALYSIS_ENGINE_UNAVAILABLE",
  "ANALYSIS_TIMEOUT",
  "ANALYSIS_OUTPUT_INVALID",
  "LEASE_EXPIRED",
  "INTERNAL",
] as const;
export type AnalysisFailureCode = (typeof ANALYSIS_FAILURE_CODES)[number];

export const RETRYABLE_FAILURE_CODES = [
  "TRANSCRIPTION_ENGINE_UNAVAILABLE",
  "TRANSCRIPTION_TIMEOUT",
  "ANALYSIS_ENGINE_UNAVAILABLE",
  "ANALYSIS_TIMEOUT",
  "ANALYSIS_OUTPUT_INVALID",
  "LEASE_EXPIRED",
] as const;

export function isRetryableFailureCode(code: AnalysisFailureCode): boolean {
  return (RETRYABLE_FAILURE_CODES as readonly string[]).includes(code);
}

export const INELIGIBILITY_REASONS = [
  "SESSION_CANCELLED",
  "SESSION_NOT_COMPLETED",
  "STUDENT_AUDIO_MISSING",
  "ARTIFACT_NOT_FOR_SESSION",
  "ARTIFACT_ROLE_MISMATCH",
  "ARTIFACT_IMPLAUSIBLE_DURATION",
  "ALREADY_ANALYZED",
  "RUN_IN_FLIGHT",
] as const;
export type AnalysisIneligibilityReason = (typeof INELIGIBILITY_REASONS)[number];

export type SessionAnalysisPolicy = {
  minDurationMs: number;
  maxDurationMs: number;
  confidenceThreshold: number;
  overuseThreshold: number;
  weakPointMinimumOccurrences: number;
  optionalImprovementCap: number;
  generalSuggestionCap: number;
  longPauseMs: number;
  maxAttempts: number;
};

export type SessionSnapshot = {
  id: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
};

export type AudioArtifactSnapshot = {
  id: string;
  sessionId: string;
  participantRole: AudioParticipantRole;
  storageKey: string;
  durationMs: number;
  contentSha256: string;
  capturedAt: Date;
};

export type ExistingRunSnapshot = {
  status:
    | "QUEUED"
    | "TRANSCRIBING"
    | "ANALYZING"
    | "SUCCEEDED"
    | "FAILED"
    | "ABANDONED";
  studentAudioArtifactId: string;
  teacherAudioArtifactId: string | null;
};

export type TranscriptSegment = {
  index: number;
  speaker: AudioParticipantRole;
  startMs: number;
  endMs: number;
  text: string;
  confidence: number | null;
};

export type TranscriptSource = {
  participantRole: AudioParticipantRole;
  contentSha256: string;
  engine: string;
  model: string;
  paramsHash: string;
};

export type SessionTranscript = {
  schemaVersion: number;
  language: string;
  segments: TranscriptSegment[];
  studentWordCount: number;
  teacherWordCount: number | null;
  studentSpeakingMs: number;
  teacherSpeakingMs: number | null;
  meanStudentConfidence: number | null;
  sources: TranscriptSource[];
};

export type ProposedCorrection = {
  type: CorrectionType;
  subtype: string;
  originalText: string;
  correctedText: string;
  explanation: string;
  transcriptSegmentIndex: number;
  charStart: number | null;
  charEnd: number | null;
  confidence: number;
};

export type AcceptedCorrection = ProposedCorrection & {
  rank: number;
  provenance: "AI_OBSERVATION";
  weakPointKey: string | null;
};

export type ProposedVocabularyObservation = {
  headword: string;
  lemma: string | null;
  partOfSpeech: string;
  status: "USED_CORRECTLY" | "MISUSED" | "OVERUSED";
  occurrenceCount: number;
  cefrLevel: EnglishLevel | null;
  segmentIndexes: number[];
  exampleExcerpt: string | null;
  confidence: number;
  alternatives: ProposedVocabularyAlternative[];
};

export type ProposedVocabularyAlternative = {
  suggestion: string;
  cefrLevel: EnglishLevel;
  exampleSentence: string | null;
  definitionFa: string | null;
};

export type SessionVocabularyObservation = Omit<
  ProposedVocabularyObservation,
  "alternatives"
> & {
  rank: number;
  provenance: "AI_OBSERVATION";
  alternatives: SessionVocabularyAlternative[];
};

export type SessionVocabularyAlternative = ProposedVocabularyAlternative & {
  rank: number;
  provenance: "AI_RECOMMENDATION";
  maxAllowedLevel: EnglishLevel;
};

export type SessionWeakPoint = {
  rank: number;
  provenance: "AI_OBSERVATION";
  category: WeakPointCategory;
  subtype: string;
  severity: WeakPointSeverity;
  occurrenceCount: number;
  confidence: number;
  explanation: string;
};

export type SessionSuggestion = {
  rank: number;
  provenance: "AI_RECOMMENDATION";
  weakPointKey: string | null;
  priority: SuggestionPriority;
  kind: SuggestionKind;
  focus: string;
  rationale: string;
  activity: string;
  targetDescription: string;
  targetSubtype: string | null;
  targetMaxOccurrences: number | null;
  targetLevel: EnglishLevel | null;
  estimatedMinutes: number | null;
};

export type SessionFluencyProfile = {
  provenance: "AI_OBSERVATION";
  studentSpeakingMs: number;
  studentWordCount: number;
  studentWordsPerMinute: number;
  studentSpeakingRatio: number | null;
  pauseCount: number;
  longPauseCount: number;
  meanPauseMs: number | null;
  longestPauseMs: number | null;
  fillerWordCount: number;
  fillerWordRate: number;
  selfCorrectionCount: number;
  repetitionCount: number;
  abandonedSentenceCount: number;
  turnCount: number | null;
  meanStudentTurnMs: number | null;
  longestStudentTurnMs: number | null;
  distinctWordCount: number;
  typeTokenRatio: number | null;
  narrativeFeedbackEn: string;
  narrativeFeedbackFa: string | null;
};

export type SessionTeacherFeedback = {
  provenance: "TEACHER_JUDGEMENT";
  body: string;
  focusNextSession: string | null;
};

export type SessionAnalysisAssembly = {
  transcript: SessionTranscript;
  corrections: AcceptedCorrection[];
  vocabulary: SessionVocabularyObservation[];
  fluency: SessionFluencyProfile;
  weakPoints: SessionWeakPoint[];
  suggestions: SessionSuggestion[];
  degradations: AnalysisDegradation[];
  resolvedStudentLevel: EnglishLevel | null;
  overallLevelEstimate: EnglishLevel | null;
  summaryEn: string;
  summaryFa: string | null;
};
