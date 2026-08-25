import "server-only";

import {
  decideLiveSessionCompletion,
  type LiveSessionCompletionBlockedReason,
} from "@/lib/domain/live-session/completion";
import {
  reduceLiveSessionEvidence,
} from "@/lib/domain/live-session/evidence";
import type {
  LiveSessionEvidenceTimingPolicy,
} from "@/lib/domain/live-session/policy";
import {
  getLiveSessionTimingPolicy,
} from "@/lib/env/live-session";
import {
  prisma,
} from "@/lib/db/prisma";
import {
  LiveSessionConflictError,
  LiveSessionTargetNotFoundError,
} from "@/lib/errors/live-session-errors";
import {
  lockSpeakingSessionScope,
} from "@/lib/services/booking-locks";
import {
  liveSessionEventSelect,
  liveSessionGrantSelect,
  toLiveSessionCredentialGrant,
  toLiveSessionProviderEvidenceEvent,
} from "@/lib/services/live-session-records";
import {
  runSerializableTransaction,
} from "@/lib/services/serializable-transaction";

const completionSessionSelect = {
  id: true,
  status: true,
  startAt: true,
  endAt: true,
} as const;

export type LiveSessionCompletionResult =
  | {
      completed: true;
      alreadyCompleted: boolean;
      sessionId: string;
      effectiveAt: Date | null;
      studentPresenceMs: number | null;
      teacherPresenceMs: number | null;
    }
  | {
      completed: false;
      reason: LiveSessionCompletionBlockedReason;
      sessionId: string;
    };

export async function completeLiveSpeakingSession(
  sessionId: string,
  options: {
    asOf?: Date;
    policy?: LiveSessionEvidenceTimingPolicy;
  } = {},
): Promise<LiveSessionCompletionResult> {
  const asOf = options.asOf ?? new Date();
  const policy = options.policy ?? getLiveSessionTimingPolicy();

  return runSerializableTransaction(
    async (tx) => {
      await lockSpeakingSessionScope(tx, sessionId);

      const session = await tx.speakingSession.findUnique({
        where: { id: sessionId },
        select: completionSessionSelect,
      });

      if (!session) {
        throw new LiveSessionTargetNotFoundError();
      }

      const [grants, events] = await Promise.all([
        tx.speakingSessionLiveGrant.findMany({
          where: { sessionId: session.id },
          select: liveSessionGrantSelect,
        }),
        tx.speakingSessionLiveEvent.findMany({
          where: { sessionId: session.id },
          select: liveSessionEventSelect,
        }),
      ]);

      const reduction = reduceLiveSessionEvidence({
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

      const decision = decideLiveSessionCompletion({
        session,
        reduction,
        asOf,
      });

      if (!decision.completable) {
        if (decision.reason === "ALREADY_COMPLETED") {
          return {
            completed: true,
            alreadyCompleted: true,
            sessionId: session.id,
            effectiveAt: null,
            studentPresenceMs: null,
            teacherPresenceMs: null,
          };
        }

        return {
          completed: false,
          reason: decision.reason,
          sessionId: session.id,
        };
      }

      const transitioned = await tx.speakingSession.updateMany({
        where: {
          id: session.id,
          status: "SCHEDULED",
        },
        data: {
          status: "COMPLETED",
        },
      });

      if (transitioned.count === 1) {
        return {
          completed: true,
          alreadyCompleted: false,
          sessionId: session.id,
          effectiveAt: decision.effectiveAt,
          studentPresenceMs: decision.studentPresenceMs,
          teacherPresenceMs: decision.teacherPresenceMs,
        };
      }

      const latest = await tx.speakingSession.findUnique({
        where: { id: session.id },
        select: { status: true },
      });

      if (latest?.status === "COMPLETED") {
        return {
          completed: true,
          alreadyCompleted: true,
          sessionId: session.id,
          effectiveAt: null,
          studentPresenceMs: null,
          teacherPresenceMs: null,
        };
      }

      if (latest?.status === "CANCELLED") {
        return {
          completed: false,
          reason: "SESSION_CANCELLED",
          sessionId: session.id,
        };
      }

      throw new LiveSessionConflictError();
    },
    {
      maxAttempts: 3,
      conflictErrorFactory: () => new LiveSessionConflictError(),
    },
  );
}

export type LiveSessionCompletionJobResult = Readonly<{
  selected: number;
  completed: number;
  skipped: number;
  failed: number;
}>;

export async function processDueLiveSessionCompletions(
  limit: number,
  options: {
    asOf?: Date;
    policy?: LiveSessionEvidenceTimingPolicy;
    sessionId?: string;
  } = {},
): Promise<LiveSessionCompletionJobResult> {
  const asOf = options.asOf ?? new Date();
  const policy = options.policy ?? getLiveSessionTimingPolicy();
  const horizonCutoff = new Date(
    asOf.getTime() - policy.evidenceHorizonGraceMs,
  );

  const candidates = options.sessionId
    ? await prisma.speakingSession.findMany({
        where: {
          id: options.sessionId,
          status: "SCHEDULED",
        },
        select: { id: true },
        take: 1,
      })
    : await prisma.speakingSession.findMany({
        where: {
          status: "SCHEDULED",
          endAt: {
            lte: horizonCutoff,
          },
        },
        orderBy: [
          { endAt: "asc" },
          { id: "asc" },
        ],
        select: { id: true },
        take: limit,
      });

  let completed = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const result = await completeLiveSpeakingSession(candidate.id, {
        asOf,
        policy,
      });

      if (result.completed) {
        completed += 1;
      } else {
        skipped += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return {
    selected: candidates.length,
    completed,
    skipped,
    failed,
  };
}
