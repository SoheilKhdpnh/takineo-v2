import {
  getUserAccessContext,
} from "@/lib/auth/access";
import {
  getApiSession,
} from "@/lib/auth/api-session";
import {
  liveSessionMutationErrorResponse,
  liveSessionPrivateJson,
} from "@/lib/errors/live-session-http";
import {
  hasTrustedRequestOrigin,
} from "@/lib/security/same-origin";
import {
  issueLiveSessionJoinGrant,
} from "@/lib/services/live-session-grant.service";
import {
  issueLiveSessionJoinBodySchema,
  issueLiveSessionJoinSchema,
} from "@/lib/validations/live-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!hasTrustedRequestOrigin(request)) {
    return liveSessionPrivateJson(
      { error: "UNTRUSTED_ORIGIN" },
      { status: 403 },
    );
  }

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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return liveSessionPrivateJson(
      { error: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const { sessionId } = await context.params;
  const parsedBody = issueLiveSessionJoinBodySchema.safeParse(body);

  if (!parsedBody.success) {
    return liveSessionPrivateJson(
      {
        error: "INVALID_REQUEST",
        fields: parsedBody.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const parsedInput = issueLiveSessionJoinSchema.safeParse({
    sessionId,
    ...parsedBody.data,
  });

  if (!parsedInput.success) {
    return liveSessionPrivateJson(
      {
        error: "INVALID_REQUEST",
        fields: parsedInput.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const result = await issueLiveSessionJoinGrant(
      session.user.id,
      parsedInput.data,
    );

    return liveSessionPrivateJson({
      grant: {
        grantId: result.grant.grantId,
        sessionId: result.grant.sessionId,
        participantRole: result.grant.participantRole,
        authorizedAt: result.grant.authorizedAt.toISOString(),
      },
      credential: result.credential,
      expiresAt: result.expiresAt.toISOString(),
      replayed: result.replayed,
    });
  } catch (error) {
    return liveSessionMutationErrorResponse(error);
  }
}
