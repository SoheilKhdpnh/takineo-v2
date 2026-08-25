import "server-only";

import {
  authorizeLiveSessionJoin,
  deriveLiveSessionJoinWindow,
  type LiveSessionEvidenceTimingPolicy,
} from "@/lib/domain/live-session/policy";
import type {
  LiveSessionCredentialGrant,
  LiveSessionIssuedCredential,
} from "@/lib/domain/live-session/provider";
import {
  getLiveSessionTimingPolicy,
} from "@/lib/env/live-session";
import {
  LiveSessionConflictError,
  LiveSessionJoinAttemptConflictError,
  LiveSessionJoinDeniedError,
  LiveSessionTargetNotFoundError,
} from "@/lib/errors/live-session-errors";
import {
  LIVE_SESSION_CONSTRAINT,
} from "@/lib/live-session/constraint-identity";
import {
  getLiveSessionProvider,
  type LiveSessionRuntimeProvider,
} from "@/lib/live-session/provider";
import {
  lockSpeakingSessionScope,
} from "@/lib/services/booking-locks";
import {
  isLiveSessionUniqueConflict,
  liveSessionGrantSelect,
  liveSessionJoinSessionSelect,
  toLiveSessionCredentialGrant,
} from "@/lib/services/live-session-records";
import {
  runSerializableTransaction,
} from "@/lib/services/serializable-transaction";
import {
  issueLiveSessionJoinSchema,
  type IssueLiveSessionJoinInput,
} from "@/lib/validations/live-session";

const PROVIDER_PARTICIPANT_REF_ATTEMPTS = 3;

export type IssuedLiveSessionJoin = Readonly<{
  grant: LiveSessionCredentialGrant;
  credential: string;
  expiresAt: Date;
  replayed: boolean;
}>;

export async function issueLiveSessionJoinGrant(
  actorUserId: string,
  input: IssueLiveSessionJoinInput,
  options: {
    asOf?: Date;
    policy?: LiveSessionEvidenceTimingPolicy;
    provider?: LiveSessionRuntimeProvider;
  } = {},
): Promise<IssuedLiveSessionJoin> {
  const parsed = issueLiveSessionJoinSchema.parse(input);
  const asOf = options.asOf ?? new Date();
  const policy = options.policy ?? getLiveSessionTimingPolicy();
  const provider = options.provider ?? getLiveSessionProvider();

  const persisted = await runSerializableTransaction(
    async (tx) => {
      await lockSpeakingSessionScope(tx, parsed.sessionId);

      const [actor, session] = await Promise.all([
        tx.user.findUnique({
          where: { id: actorUserId },
          select: {
            id: true,
            accountStatus: true,
          },
        }),
        tx.speakingSession.findUnique({
          where: { id: parsed.sessionId },
          select: liveSessionJoinSessionSelect,
        }),
      ]);

      if (!actor) {
        throw new LiveSessionTargetNotFoundError();
      }

      if (!session) {
        throw new LiveSessionTargetNotFoundError();
      }

      const authorization = authorizeLiveSessionJoin({
        session: {
          id: session.id,
          status: session.status,
          startAt: session.startAt,
          endAt: session.endAt,
          studentUserId: session.studentUserId,
          teacherUserId: session.teacherProfile.userId,
        },
        actor: {
          userId: actor.id,
          active: actor.accountStatus === "ACTIVE",
        },
        joinWindow: deriveLiveSessionJoinWindow({
          session: {
            startAt: session.startAt,
            endAt: session.endAt,
          },
          policy,
        }),
        asOf,
      });

      if (!authorization.allowed) {
        throw new LiveSessionJoinDeniedError(authorization.reason);
      }

      const existing = await tx.speakingSessionLiveGrant.findUnique({
        where: {
          participantUserId_clientJoinAttemptId: {
            participantUserId: actor.id,
            clientJoinAttemptId: parsed.clientJoinAttemptId,
          },
        },
        select: liveSessionGrantSelect,
      });

      if (existing) {
        if (existing.sessionId !== session.id) {
          throw new LiveSessionJoinAttemptConflictError();
        }

        return {
          grant: existing,
          replayed: true,
        };
      }

      let lastError: unknown;

      for (
        let attempt = 1;
        attempt <= PROVIDER_PARTICIPANT_REF_ATTEMPTS;
        attempt += 1
      ) {
        const providerParticipantRef =
          provider.allocateProviderParticipantRef();

        try {
          const created = await tx.speakingSessionLiveGrant.create({
            data: {
              sessionId: session.id,
              participantUserId: actor.id,
              participantRole: authorization.participantRole,
              clientJoinAttemptId: parsed.clientJoinAttemptId,
              providerParticipantRef,
            },
            select: liveSessionGrantSelect,
          });

          return {
            grant: created,
            replayed: false,
          };
        } catch (error) {
          if (
            isLiveSessionUniqueConflict(
              error,
              LIVE_SESSION_CONSTRAINT.GRANT_JOIN_ATTEMPT,
            )
          ) {
            const raced = await tx.speakingSessionLiveGrant.findUnique({
              where: {
                participantUserId_clientJoinAttemptId: {
                  participantUserId: actor.id,
                  clientJoinAttemptId: parsed.clientJoinAttemptId,
                },
              },
              select: liveSessionGrantSelect,
            });

            if (raced && raced.sessionId === session.id) {
              return {
                grant: raced,
                replayed: true,
              };
            }

            throw new LiveSessionJoinAttemptConflictError();
          }

          if (
            isLiveSessionUniqueConflict(
              error,
              LIVE_SESSION_CONSTRAINT.GRANT_PROVIDER_PARTICIPANT,
            )
          ) {
            lastError = error;
            continue;
          }

          throw error;
        }
      }

      throw lastError ?? new LiveSessionConflictError();
    },
    {
      maxAttempts: 3,
      conflictErrorFactory: () => new LiveSessionConflictError(),
    },
  );

  const grant = toLiveSessionCredentialGrant(persisted.grant);
  const issued: LiveSessionIssuedCredential =
    await provider.issueCredential({
      grant,
    });

  return {
    grant,
    credential: issued.credential,
    expiresAt: issued.expiresAt,
    replayed: persisted.replayed,
  };
}
