import type {
  AnalysisIneligibilityReason,
  AudioArtifactSnapshot,
  ExistingRunSnapshot,
  SessionAnalysisPolicy,
  SessionSnapshot,
} from "./types";

export type AnalysisEligibilityDecision =
  | { eligible: true }
  | { eligible: false; reason: AnalysisIneligibilityReason };

const IN_FLIGHT_STATUSES = new Set(["QUEUED", "TRANSCRIBING", "ANALYZING"]);

function assertValidDate(value: Date, label: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new RangeError(`${label} must be a valid Date.`);
  }
}

function assertArtifactShape(artifact: AudioArtifactSnapshot, label: string): void {
  if (!artifact.sessionId || artifact.sessionId.trim() !== artifact.sessionId) {
    throw new RangeError(`${label} sessionId must be a non-blank trimmed string.`);
  }

  if (!artifact.storageKey || artifact.storageKey.trim() !== artifact.storageKey) {
    throw new RangeError(`${label} storageKey must be a non-blank trimmed string.`);
  }

  if (!Number.isInteger(artifact.durationMs) || artifact.durationMs <= 0) {
    throw new RangeError(`${label} durationMs must be a positive integer.`);
  }

  if (!/^[0-9a-f]{64}$/.test(artifact.contentSha256)) {
    throw new RangeError(`${label} contentSha256 must be 64-character lowercase hex.`);
  }

  assertValidDate(artifact.capturedAt, `${label} capturedAt`);
}

export function decideAnalysisEligibility(input: {
  session: SessionSnapshot;
  studentArtifact: AudioArtifactSnapshot | null;
  teacherArtifact: AudioArtifactSnapshot | null;
  existingRuns: ExistingRunSnapshot[];
  policy: SessionAnalysisPolicy;
}): AnalysisEligibilityDecision {
  const { session, studentArtifact, teacherArtifact, existingRuns, policy } =
    input;

  if (session.status === "CANCELLED") {
    return { eligible: false, reason: "SESSION_CANCELLED" };
  }

  if (session.status !== "COMPLETED") {
    return { eligible: false, reason: "SESSION_NOT_COMPLETED" };
  }

  if (!studentArtifact) {
    return { eligible: false, reason: "STUDENT_AUDIO_MISSING" };
  }

  assertArtifactShape(studentArtifact, "studentArtifact");
  if (teacherArtifact) {
    assertArtifactShape(teacherArtifact, "teacherArtifact");
  }

  if (studentArtifact.sessionId !== session.id) {
    return { eligible: false, reason: "ARTIFACT_NOT_FOR_SESSION" };
  }

  if (teacherArtifact && teacherArtifact.sessionId !== session.id) {
    return { eligible: false, reason: "ARTIFACT_NOT_FOR_SESSION" };
  }

  if (studentArtifact.participantRole !== "STUDENT") {
    return { eligible: false, reason: "ARTIFACT_ROLE_MISMATCH" };
  }

  if (teacherArtifact && teacherArtifact.participantRole !== "TEACHER") {
    return { eligible: false, reason: "ARTIFACT_ROLE_MISMATCH" };
  }

  if (
    studentArtifact.durationMs < policy.minDurationMs ||
    studentArtifact.durationMs > policy.maxDurationMs
  ) {
    return { eligible: false, reason: "ARTIFACT_IMPLAUSIBLE_DURATION" };
  }

  if (
    teacherArtifact &&
    (teacherArtifact.durationMs < policy.minDurationMs ||
      teacherArtifact.durationMs > policy.maxDurationMs)
  ) {
    return { eligible: false, reason: "ARTIFACT_IMPLAUSIBLE_DURATION" };
  }

  const pairAlreadySucceeded = existingRuns.some(
    (run) =>
      run.status === "SUCCEEDED" &&
      run.studentAudioArtifactId === studentArtifact.id &&
      run.teacherAudioArtifactId === (teacherArtifact?.id ?? null),
  );
  if (pairAlreadySucceeded) {
    return { eligible: false, reason: "ALREADY_ANALYZED" };
  }

  if (existingRuns.some((run) => IN_FLIGHT_STATUSES.has(run.status))) {
    return { eligible: false, reason: "RUN_IN_FLIGHT" };
  }

  return { eligible: true };
}
