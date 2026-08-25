import type {
  LiveSessionCredentialGrant,
  LiveSessionProviderEvidenceEvent,
} from "@/lib/domain/live-session/provider";
import {
  Prisma,
} from "@/lib/generated/prisma/client";
import {
  getLiveSessionConstraintIdentity,
  LIVE_SESSION_CONSTRAINT,
  type LiveSessionConstraintName,
} from "@/lib/live-session/constraint-identity";

export const liveSessionGrantSelect = {
  id: true,
  sessionId: true,
  participantUserId: true,
  participantRole: true,
  clientJoinAttemptId: true,
  providerParticipantRef: true,
  authorizedAt: true,
} as const;

export const liveSessionEventSelect = {
  providerEventRef: true,
  sessionId: true,
  type: true,
  occurredAt: true,
  providerParticipantRef: true,
  connectionRef: true,
} as const;

export const liveSessionJoinSessionSelect = {
  id: true,
  status: true,
  startAt: true,
  endAt: true,
  studentUserId: true,
  teacherProfile: {
    select: {
      userId: true,
    },
  },
} as const;

export type LiveSessionGrantRow =
  Prisma.SpeakingSessionLiveGrantGetPayload<{
    select: typeof liveSessionGrantSelect;
  }>;

export type LiveSessionEventRow =
  Prisma.SpeakingSessionLiveEventGetPayload<{
    select: typeof liveSessionEventSelect;
  }>;

export type LiveSessionJoinSessionRow =
  Prisma.SpeakingSessionGetPayload<{
    select: typeof liveSessionJoinSessionSelect;
  }>;

export function toLiveSessionCredentialGrant(
  row: LiveSessionGrantRow,
): LiveSessionCredentialGrant {
  return {
    grantId: row.id,
    sessionId: row.sessionId,
    clientJoinAttemptId: row.clientJoinAttemptId,
    participantUserId: row.participantUserId,
    participantRole: row.participantRole,
    providerParticipantRef: row.providerParticipantRef,
    authorizedAt: row.authorizedAt,
  };
}

export function toLiveSessionProviderEvidenceEvent(
  row: LiveSessionEventRow,
): LiveSessionProviderEvidenceEvent {
  if (row.type === "ROOM_ENDED") {
    return {
      type: "ROOM_ENDED",
      providerEventRef: row.providerEventRef,
      sessionId: row.sessionId,
      occurredAt: row.occurredAt,
    };
  }

  if (
    row.providerParticipantRef === null ||
    row.connectionRef === null
  ) {
    throw new RangeError(
      "Persisted participant live-session events must carry provider and connection refs.",
    );
  }

  return {
    type: row.type,
    providerEventRef: row.providerEventRef,
    sessionId: row.sessionId,
    occurredAt: row.occurredAt,
    providerParticipantRef: row.providerParticipantRef,
    connectionRef: row.connectionRef,
  };
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isPrismaKnownRequestError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError
  ) {
    return true;
  }

  return (
    isRecord(error) &&
    error.name === "PrismaClientKnownRequestError" &&
    typeof error.code === "string"
  );
}

export function liveSessionConstraintFromError(
  error: unknown,
): LiveSessionConstraintName | null {
  return getLiveSessionConstraintIdentity(error);
}

export function isLiveSessionUniqueConflict(
  error: unknown,
  constraint: LiveSessionConstraintName,
): boolean {
  if (!isPrismaKnownRequestError(error) || error.code !== "P2002") {
    return false;
  }

  return liveSessionConstraintFromError(error) === constraint;
}

export function isLiveSessionShapeConflict(
  error: unknown,
): boolean {
  if (!isPrismaKnownRequestError(error)) {
    return false;
  }

  if (
    error.code !== "P2002" &&
    error.code !== "P2004" &&
    error.code !== "P2010"
  ) {
    const identity = liveSessionConstraintFromError(error);
    return identity === LIVE_SESSION_CONSTRAINT.EVENT_PARTICIPANT_SHAPE;
  }

  return (
    liveSessionConstraintFromError(error) ===
    LIVE_SESSION_CONSTRAINT.EVENT_PARTICIPANT_SHAPE
  );
}
