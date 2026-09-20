import type {
  LiveSessionProviderEvidenceEvent,
} from "@/lib/domain/live-session/provider";
import {
  LiveSessionMalformedEventError,
} from "@/lib/errors/live-session-errors";
import {
  sessionIdFromLiveKitRoomName,
} from "@/lib/live-session/room-name";

const MAPPED_LIVEKIT_EVENTS = {
  participant_joined: "PARTICIPANT_CONNECTED",
  participant_left: "PARTICIPANT_DISCONNECTED",
  room_finished: "ROOM_ENDED",
} as const;

type MappedLiveKitEventName = keyof typeof MAPPED_LIVEKIT_EVENTS;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNonEmptyString(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  if (value.length === 0 || value !== value.trim() || /\s/.test(value)) {
    return null;
  }

  return value;
}

function isMappedLiveKitEventName(
  value: string,
): value is MappedLiveKitEventName {
  return value in MAPPED_LIVEKIT_EVENTS;
}

function occurredAtFromUnix(
  createdAt: number,
): Date | null {
  if (!Number.isFinite(createdAt) || createdAt <= 0) {
    return null;
  }

  const millis = createdAt > 1_000_000_000_000
    ? createdAt
    : createdAt * 1000;
  const occurredAt = new Date(millis);

  if (Number.isNaN(occurredAt.getTime())) {
    return null;
  }

  return occurredAt;
}

function occurredAtFromLiveKit(
  createdAt: unknown,
): Date | null {
  if (typeof createdAt === "bigint") {
    return occurredAtFromUnix(Number(createdAt));
  }

  if (typeof createdAt === "number") {
    return occurredAtFromUnix(createdAt);
  }

  if (typeof createdAt === "string" && /^[0-9]+$/.test(createdAt)) {
    return occurredAtFromUnix(Number(createdAt));
  }

  return null;
}

function readRoomName(
  payload: Record<string, unknown>,
): string | null {
  if (!isRecord(payload.room)) {
    return null;
  }

  return readNonEmptyString(payload.room.name);
}

function readParticipantIdentity(
  payload: Record<string, unknown>,
): { providerParticipantRef: string; connectionRef: string } | null {
  if (!isRecord(payload.participant)) {
    return null;
  }

  const providerParticipantRef = readNonEmptyString(
    payload.participant.identity,
  );
  const connectionRef = readNonEmptyString(payload.participant.sid);

  if (!providerParticipantRef || !connectionRef) {
    return null;
  }

  return {
    providerParticipantRef,
    connectionRef,
  };
}

/**
 * Maps a verified LiveKit webhook JSON body onto Takineo evidence events.
 *
 * Unmapped LiveKit event names, and rooms that are not speaking-session
 * rooms, return null so the receiver can acknowledge without ingesting.
 */
export function mapLiveKitWebhookEvent(
  payload: unknown,
): LiveSessionProviderEvidenceEvent | null {
  if (!isRecord(payload)) {
    throw new LiveSessionMalformedEventError();
  }

  const eventName = readNonEmptyString(payload.event);

  if (!eventName) {
    throw new LiveSessionMalformedEventError();
  }

  if (!isMappedLiveKitEventName(eventName)) {
    return null;
  }

  const roomName = readRoomName(payload);
  const sessionId = roomName
    ? sessionIdFromLiveKitRoomName(roomName)
    : null;

  if (!sessionId) {
    return null;
  }

  const providerEventRef = readNonEmptyString(payload.id);
  const occurredAt = occurredAtFromLiveKit(payload.createdAt);

  if (!providerEventRef || !occurredAt) {
    throw new LiveSessionMalformedEventError();
  }

  if (eventName === "room_finished") {
    return {
      type: "ROOM_ENDED",
      providerEventRef,
      sessionId,
      occurredAt,
    };
  }

  const participant = readParticipantIdentity(payload);

  if (!participant) {
    throw new LiveSessionMalformedEventError();
  }

  return {
    type: MAPPED_LIVEKIT_EVENTS[eventName],
    providerEventRef,
    sessionId,
    occurredAt,
    providerParticipantRef: participant.providerParticipantRef,
    connectionRef: participant.connectionRef,
  };
}
