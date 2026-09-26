import "server-only";

import {
  reduceLiveSessionEvidence,
  type LiveSessionEvidenceReduction,
} from "@/lib/domain/live-session/evidence";
import type {
  LiveSessionEvidenceTimingPolicy,
} from "@/lib/domain/live-session/policy";
import {
  getLiveSessionTimingPolicy,
} from "@/lib/env/live-session";
import {
  LiveSessionAccountInactiveError,
  LiveSessionNotParticipantError,
  LiveSessionTargetNotFoundError,
} from "@/lib/errors/live-session-errors";
import {
  prisma,
} from "@/lib/db/prisma";
import {
  liveSessionEventSelect,
  liveSessionGrantSelect,
  liveSessionJoinSessionSelect,
  toLiveSessionCredentialGrant,
  toLiveSessionProviderEvidenceEvent,
} from "@/lib/services/live-session-records";

export async function readLiveSessionEvidence(
  actorUserId: string,
  sessionId: string,
  options: {
    asOf?: Date;
    policy?: LiveSessionEvidenceTimingPolicy;
  } = {},
): Promise<LiveSessionEvidenceReduction> {
  const asOf = options.asOf ?? new Date();
  const policy = options.policy ?? getLiveSessionTimingPolicy();

  const [actor, session] = await Promise.all([
    prisma.user.findUnique({
      where: { id: actorUserId },
      select: {
        id: true,
        accountStatus: true,
      },
    }),
    prisma.speakingSession.findUnique({
      where: { id: sessionId },
      select: liveSessionJoinSessionSelect,
    }),
  ]);

  if (!actor || !session) {
    throw new LiveSessionTargetNotFoundError();
  }

  const isParticipant =
    actor.id === session.studentUserId ||
    actor.id === session.teacherProfile.userId;

  if (!isParticipant) {
    throw new LiveSessionNotParticipantError();
  }

  if (actor.accountStatus !== "ACTIVE") {
    throw new LiveSessionAccountInactiveError();
  }

  const [grants, events] = await Promise.all([
    prisma.speakingSessionLiveGrant.findMany({
      where: { sessionId: session.id },
      select: liveSessionGrantSelect,
    }),
    prisma.speakingSessionLiveEvent.findMany({
      where: { sessionId: session.id },
      select: liveSessionEventSelect,
    }),
  ]);

  return reduceLiveSessionEvidence({
    session: {
      id: session.id,
      startAt: session.startAt,
      endAt: session.endAt,
    },
    grants: grants.map(toLiveSessionCredentialGrant),
    events: events.map(toLiveSessionProviderEvidenceEvent),
    policy,
    asOf,
  });
}
