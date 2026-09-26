import {
  getUserAccessContext,
} from "@/lib/auth/access";
import {
  getApiSession,
} from "@/lib/auth/api-session";
import {
  liveSessionPrivateJson,
  liveSessionReadErrorResponse,
} from "@/lib/errors/live-session-http";
import {
  readLiveSessionEvidence,
} from "@/lib/services/live-session-evidence.service";
import {
  liveSessionReadIdSchema,
} from "@/lib/validations/live-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const session = await getApiSession(request);

  if (!session) {
    return liveSessionPrivateJson(
      { error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const access = await getUserAccessContext(session.user.id);

  if (!access || access.accountStatus !== "ACTIVE") {
    return liveSessionPrivateJson(
      { error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { sessionId } = await context.params;
  const parsedSessionId = liveSessionReadIdSchema.safeParse(sessionId);

  if (!parsedSessionId.success) {
    return liveSessionPrivateJson(
      {
        error: "INVALID_REQUEST",
        fields: {
          sessionId: parsedSessionId.error.issues.map(
            (issue) => issue.message,
          ),
        },
      },
      { status: 400 },
    );
  }

  try {
    const reduction = await readLiveSessionEvidence(
      session.user.id,
      parsedSessionId.data,
    );

    return liveSessionPrivateJson({
      sessionId: reduction.sessionId,
      asOf: reduction.asOf.toISOString(),
      analyticalHorizonAt: reduction.analyticalHorizonAt.toISOString(),
      liveEvidenceHorizonAt: reduction.liveEvidenceHorizonAt.toISOString(),
      roomEndedAt: reduction.roomEndedAt
        ? reduction.roomEndedAt.toISOString()
        : null,
      conflictingProviderEventRefCount:
        reduction.conflictingProviderEventRefCount,
      unattributedParticipantEventCount:
        reduction.unattributedParticipantEventCount,
      participants: reduction.participants.map((participant) => ({
        participantUserId: participant.participantUserId,
        participantRole: participant.participantRole,
        presenceMs: participant.presenceMs,
        reconnectCount: participant.reconnectCount,
        evidenceQuality: participant.evidenceQuality,
        invalidSequenceCount: participant.invalidSequenceCount,
        orphanDisconnectCount: participant.orphanDisconnectCount,
        openConnectionCount: participant.openConnectionCount,
        intervals: participant.intervals.map((interval) => ({
          providerParticipantRef: interval.providerParticipantRef,
          connectionRef: interval.connectionRef,
          startedAt: interval.startedAt.toISOString(),
          endedAt: interval.endedAt.toISOString(),
          intervalEndReason: interval.intervalEndReason,
          evidenceQuality: interval.evidenceQuality,
        })),
      })),
    });
  } catch (error) {
    const response = liveSessionReadErrorResponse(error);

    if (response) {
      return response;
    }

    console.error("Unexpected live-session evidence read error:", error);

    return liveSessionPrivateJson(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    );
  }
}
