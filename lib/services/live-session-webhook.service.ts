import "server-only";

import type {
  LiveSessionProviderEvidenceEvent,
} from "@/lib/domain/live-session/provider";
import {
  LiveSessionEventShapeConflictError,
  LiveSessionUnknownSessionError,
} from "@/lib/errors/live-session-errors";
import {
  LIVE_SESSION_CONSTRAINT,
} from "@/lib/live-session/constraint-identity";
import {
  isLiveSessionShapeConflict,
  isLiveSessionUniqueConflict,
} from "@/lib/services/live-session-records";
import {
  prisma,
} from "@/lib/db/prisma";

export type LiveSessionWebhookIngestResult = Readonly<{
  ingested: boolean;
  duplicate: boolean;
}>;

function eventCreateData(
  event: LiveSessionProviderEvidenceEvent,
) {
  if (event.type === "ROOM_ENDED") {
    return {
      sessionId: event.sessionId,
      providerEventRef: event.providerEventRef,
      type: event.type,
      occurredAt: event.occurredAt,
      providerParticipantRef: null,
      connectionRef: null,
    };
  }

  return {
    sessionId: event.sessionId,
    providerEventRef: event.providerEventRef,
    type: event.type,
    occurredAt: event.occurredAt,
    providerParticipantRef: event.providerParticipantRef,
    connectionRef: event.connectionRef,
  };
}

export async function ingestLiveSessionProviderEvent(
  event: LiveSessionProviderEvidenceEvent,
): Promise<LiveSessionWebhookIngestResult> {
  const session = await prisma.speakingSession.findUnique({
    where: { id: event.sessionId },
    select: { id: true },
  });

  if (!session) {
    throw new LiveSessionUnknownSessionError();
  }

  try {
    await prisma.speakingSessionLiveEvent.create({
      data: eventCreateData(event),
      select: { id: true },
    });

    return {
      ingested: true,
      duplicate: false,
    };
  } catch (error) {
    if (
      isLiveSessionUniqueConflict(
        error,
        LIVE_SESSION_CONSTRAINT.EVENT_PROVIDER_EVENT,
      )
    ) {
      return {
        ingested: false,
        duplicate: true,
      };
    }

    if (isLiveSessionShapeConflict(error)) {
      throw new LiveSessionEventShapeConflictError();
    }

    throw error;
  }
}
