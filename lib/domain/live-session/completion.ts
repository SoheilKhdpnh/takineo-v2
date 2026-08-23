import type {
  LiveSessionEvidenceReduction,
} from "@/lib/domain/live-session/evidence";

/**
 * Wave 3 is the only wave permitted to justify the durable transition to
 * COMPLETED, and only from live-session evidence.
 *
 * This module decides. It never writes. The durable transition is a separate,
 * explicitly authorized service effect.
 */
export type LiveSessionCompletionSessionSnapshot =
  Readonly<{
    id:
      string;

    status:
      | "SCHEDULED"
      | "COMPLETED"
      | "CANCELLED";

    startAt:
      Date;

    endAt:
      Date;
  }>;

export type LiveSessionCompletionBlockedReason =
  | "ALREADY_COMPLETED"
  | "SESSION_CANCELLED"
  | "EVIDENCE_NOT_FINAL"
  | "EVIDENCE_UNRELIABLE"
  | "NO_PARTICIPANT_PRESENCE"
  | "INCOMPLETE_PARTICIPATION";

export type LiveSessionCompletionDecision =
  | {
      completable:
        true;

      /**
       * The evidence-bounded instant the completion is justified from.
       *
       * `SpeakingSession` has no column for this and Wave 3 must not add one.
       * Persisting it requires a Wave 3-owned table.
       */
      effectiveAt:
        Date;

      studentPresenceMs:
        number;

      teacherPresenceMs:
        number;
    }
  | {
      completable:
        false;

      reason:
        LiveSessionCompletionBlockedReason;
    };

function assertValidDate(
  value:
    Date,
  label:
    string,
): void {
  if (
    !(value instanceof Date) ||
    Number.isNaN(
      value.getTime(),
    )
  ) {
    throw new RangeError(
      `${label} must be a valid Date.`,
    );
  }
}

/**
 * Decide whether reduced live-session evidence justifies durable completion.
 *
 * Reasons are evaluated in a fixed precedence so the outcome stays deterministic
 * as evidence accumulates.
 */
export function decideLiveSessionCompletion(
  input: Readonly<{
    session:
      LiveSessionCompletionSessionSnapshot;

    reduction:
      LiveSessionEvidenceReduction;

    asOf:
      Date;
  }>,
): LiveSessionCompletionDecision {
  const {
    session,
    reduction,
    asOf,
  } = input;

  assertValidDate(
    session.startAt,
    "SpeakingSession startAt",
  );

  assertValidDate(
    session.endAt,
    "SpeakingSession endAt",
  );

  assertValidDate(
    asOf,
    "Live-session completion asOf",
  );

  if (
    session.endAt.getTime() <=
    session.startAt.getTime()
  ) {
    throw new RangeError(
      "SpeakingSession endAt must be after startAt.",
    );
  }

  if (
    reduction.sessionId !==
    session.id
  ) {
    throw new RangeError(
      "Live-session completion evidence must belong to the decided session.",
    );
  }

  if (
    session.status ===
    "COMPLETED"
  ) {
    return {
      completable:
        false,

      reason:
        "ALREADY_COMPLETED",
    };
  }

  if (
    session.status ===
    "CANCELLED"
  ) {
    return {
      completable:
        false,

      reason:
        "SESSION_CANCELLED",
    };
  }

  /*
   * Before the analytical horizon, further authentic provider evidence can still
   * be attributed, so no completion decision is final yet.
   *
   * ROOM_ENDED alone is not sufficient: it bounds presence, but late authentic
   * disconnect evidence may still arrive and change evidence quality.
   */
  if (
    asOf.getTime() <
    reduction.analyticalHorizonAt.getTime()
  ) {
    return {
      completable:
        false,

      reason:
        "EVIDENCE_NOT_FINAL",
    };
  }

  const unreliable =
    reduction.participants.some(
      (participant) =>
        participant.evidenceQuality ===
        "INVALID_SEQUENCE",
    );

  if (
    unreliable
  ) {
    return {
      completable:
        false,

      reason:
        "EVIDENCE_UNRELIABLE",
    };
  }

  const presentParticipants =
    reduction.participants.filter(
      (participant) =>
        participant.presenceMs >
        0,
    );

  if (
    presentParticipants.length ===
    0
  ) {
    return {
      completable:
        false,

      reason:
        "NO_PARTICIPANT_PRESENCE",
    };
  }

  const student =
    presentParticipants.find(
      (participant) =>
        participant.participantRole ===
        "STUDENT",
    );

  const teacher =
    presentParticipants.find(
      (participant) =>
        participant.participantRole ===
        "TEACHER",
    );

  /*
   * A session where only one side appeared is a no-show outcome. Wave 2 owns
   * SpeakingSessionStatus and it has no no-show member, so Wave 3 reports the
   * blocked reason instead of inventing a durable state.
   */
  if (
    student === undefined ||
    teacher === undefined
  ) {
    return {
      completable:
        false,

      reason:
        "INCOMPLETE_PARTICIPATION",
    };
  }

  return {
    completable:
      true,

    effectiveAt:
      new Date(
        reduction.liveEvidenceHorizonAt.getTime(),
      ),

    studentPresenceMs:
      student.presenceMs,

    teacherPresenceMs:
      teacher.presenceMs,
  };
}
