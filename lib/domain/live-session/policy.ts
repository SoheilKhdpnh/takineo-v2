export const REJOIN_GRACE_POLICY_NAME =
  "REJOIN_GRACE" as const;

export const EVIDENCE_HORIZON_GRACE_POLICY_NAME =
  "EVIDENCE_HORIZON_GRACE" as const;

/**
 * M1-B freezes these as separate policies.
 *
 * Production values are intentionally not guessed here. A caller must supply
 * both values explicitly until their canonical values are frozen.
 */
export type LiveSessionEvidenceTimingPolicy =
  Readonly<{
    rejoinGraceMs:
      number;

    evidenceHorizonGraceMs:
      number;
  }>;

export type LiveSessionJoinWindow =
  Readonly<{
    opensAt:
      Date;

    closesAt:
      Date;
  }>;

export type LiveSessionParticipantRole =
  | "STUDENT"
  | "TEACHER";

export type LiveSessionJoinDenialReason =
  | "ACCOUNT_INACTIVE"
  | "NOT_PARTICIPANT"
  | "SESSION_NOT_JOINABLE"
  | "JOIN_WINDOW_NOT_OPEN"
  | "JOIN_WINDOW_CLOSED";

export type LiveSessionJoinAuthorization =
  | {
      allowed:
        true;

      participantRole:
        LiveSessionParticipantRole;
    }
  | {
      allowed:
        false;

      reason:
        LiveSessionJoinDenialReason;
    };

export type LiveSessionJoinSessionSnapshot =
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

    studentUserId:
      string;

    teacherUserId:
      string;
  }>;

export type LiveSessionJoinActorSnapshot =
  Readonly<{
    userId:
      string;

    active:
      boolean;
  }>;

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

function assertNonNegativeSafeInteger(
  value:
    number,
  label:
    string,
): void {
  if (
    !Number.isSafeInteger(
      value,
    ) ||
    value < 0
  ) {
    throw new RangeError(
      `${label} must be a non-negative safe integer.`,
    );
  }
}

export function createLiveSessionEvidenceTimingPolicy(
  input:
    LiveSessionEvidenceTimingPolicy,
): LiveSessionEvidenceTimingPolicy {
  assertNonNegativeSafeInteger(
    input.rejoinGraceMs,
    REJOIN_GRACE_POLICY_NAME,
  );

  assertNonNegativeSafeInteger(
    input.evidenceHorizonGraceMs,
    EVIDENCE_HORIZON_GRACE_POLICY_NAME,
  );

  return Object.freeze({
    rejoinGraceMs:
      input.rejoinGraceMs,

    evidenceHorizonGraceMs:
      input.evidenceHorizonGraceMs,
  });
}

export function authorizeLiveSessionJoin(
  input: Readonly<{
    session:
      LiveSessionJoinSessionSnapshot;

    actor:
      LiveSessionJoinActorSnapshot;

    joinWindow:
      LiveSessionJoinWindow;

    asOf:
      Date;
  }>,
): LiveSessionJoinAuthorization {
  const {
    session,
    actor,
    joinWindow,
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
    joinWindow.opensAt,
    "Live-session join window opensAt",
  );

  assertValidDate(
    joinWindow.closesAt,
    "Live-session join window closesAt",
  );

  assertValidDate(
    asOf,
    "Live-session authorization asOf",
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
    joinWindow.closesAt.getTime() <=
    joinWindow.opensAt.getTime()
  ) {
    throw new RangeError(
      "Live-session join window closesAt must be after opensAt.",
    );
  }

  if (
    session.studentUserId ===
    session.teacherUserId
  ) {
    throw new RangeError(
      "Live-session participant identities must be distinct.",
    );
  }

  let participantRole:
    LiveSessionParticipantRole;

  if (
    actor.userId ===
    session.studentUserId
  ) {
    participantRole =
      "STUDENT";
  }
  else if (
    actor.userId ===
    session.teacherUserId
  ) {
    participantRole =
      "TEACHER";
  }
  else {
    return {
      allowed:
        false,

      reason:
        "NOT_PARTICIPANT",
    };
  }

  if (
    !actor.active
  ) {
    return {
      allowed:
        false,

      reason:
        "ACCOUNT_INACTIVE",
    };
  }

  if (
    session.status !==
    "SCHEDULED"
  ) {
    return {
      allowed:
        false,

      reason:
        "SESSION_NOT_JOINABLE",
    };
  }

  const asOfMs =
    asOf.getTime();

  if (
    asOfMs <
    joinWindow.opensAt.getTime()
  ) {
    return {
      allowed:
        false,

      reason:
        "JOIN_WINDOW_NOT_OPEN",
    };
  }

  /*
   * Authorization uses the half-open interval [opensAt, closesAt).
   */
  if (
    asOfMs >=
    joinWindow.closesAt.getTime()
  ) {
    return {
      allowed:
        false,

      reason:
        "JOIN_WINDOW_CLOSED",
    };
  }

  return {
    allowed:
      true,

    participantRole,
  };
}
