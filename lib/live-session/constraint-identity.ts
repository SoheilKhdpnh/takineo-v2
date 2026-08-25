export const LIVE_SESSION_CONSTRAINT = {
  GRANT_PROVIDER_PARTICIPANT:
    "ss_live_grant_provider_participant_key",
  GRANT_JOIN_ATTEMPT:
    "ss_live_grant_join_attempt_key",
  EVENT_PROVIDER_EVENT:
    "ss_live_event_provider_event_key",
  EVENT_PARTICIPANT_SHAPE:
    "ss_live_event_participant_shape_check",
} as const;

export type LiveSessionConstraintName =
  (typeof LIVE_SESSION_CONSTRAINT)[keyof typeof LIVE_SESSION_CONSTRAINT];

type UnknownRecord = Record<string, unknown>;

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function readString(
  value: unknown,
): string | null {
  return typeof value === "string" && value.length > 0
    ? value
    : null;
}

function uniqueTargetKey(
  target: unknown,
): string | null {
  if (!Array.isArray(target)) {
    return readString(target);
  }

  const fields = target.filter(
    (entry): entry is string => typeof entry === "string",
  );

  if (fields.length === 0) {
    return null;
  }

  return [...fields].sort().join(",");
}

function constraintFromUniqueTarget(
  modelName: string | null,
  targetKey: string | null,
): LiveSessionConstraintName | null {
  if (modelName === "SpeakingSessionLiveGrant") {
    if (targetKey === "providerParticipantRef") {
      return LIVE_SESSION_CONSTRAINT.GRANT_PROVIDER_PARTICIPANT;
    }

    if (targetKey === "clientJoinAttemptId,participantUserId") {
      return LIVE_SESSION_CONSTRAINT.GRANT_JOIN_ATTEMPT;
    }
  }

  if (
    modelName === "SpeakingSessionLiveEvent" &&
    targetKey === "providerEventRef"
  ) {
    return LIVE_SESSION_CONSTRAINT.EVENT_PROVIDER_EVENT;
  }

  return null;
}

function namedConstraint(
  value: unknown,
): string | null {
  const direct = readString(value);

  if (direct) {
    return direct;
  }

  if (!isRecord(value)) {
    return null;
  }

  return (
    readString(value.constraint) ??
    readString(value.constraint_name) ??
    readString(value.constraintName) ??
    readString(value.index) ??
    readString(value.name)
  );
}

function walkConstraintName(
  meta: unknown,
): string | null {
  if (!isRecord(meta)) {
    return null;
  }

  const direct =
    namedConstraint(meta.constraint) ??
    namedConstraint(meta.constraint_name);

  if (direct) {
    return direct;
  }

  const driverAdapterError = meta.driverAdapterError;

  if (!isRecord(driverAdapterError)) {
    return null;
  }

  const cause = driverAdapterError.cause;

  if (!isRecord(cause)) {
    return namedConstraint(driverAdapterError.constraint);
  }

  return (
    namedConstraint(cause.constraint) ??
    namedConstraint(cause.constraint_name) ??
    namedConstraint(cause.originalConstraint)
  );
}

const LIVE_SESSION_CONSTRAINT_NAMES = new Set<string>(
  Object.values(LIVE_SESSION_CONSTRAINT),
);

export function getLiveSessionConstraintIdentity(
  error: unknown,
): LiveSessionConstraintName | null {
  if (!isRecord(error)) {
    return null;
  }

  const named = walkConstraintName(error.meta);

  if (named && LIVE_SESSION_CONSTRAINT_NAMES.has(named)) {
    return named as LiveSessionConstraintName;
  }

  const modelName = readString(error.meta && isRecord(error.meta)
    ? error.meta.modelName
    : null);

  const targetKey = isRecord(error.meta)
    ? uniqueTargetKey(error.meta.target)
    : null;

  return constraintFromUniqueTarget(modelName, targetKey);
}
