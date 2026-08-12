import {
  requireAdminAccess,
} from "@/lib/auth/admin-access";
import {
  getApiSession,
} from "@/lib/auth/api-session";
import {
  adminErrorResponse,
} from "@/lib/errors/admin-http";
import {
  sessionCancellationErrorResponse,
  sessionPrivateJson,
} from "@/lib/errors/session-cancellation-http";
import {
  hasTrustedRequestOrigin,
} from "@/lib/security/same-origin";
import {
  cancelSpeakingSessionAsAdmin,
} from "@/lib/services/session-cancellation.service";
import {
  cancelSessionAsAdminSchema,
} from "@/lib/validations/session-cancellation";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

const adminBodySchema =
  cancelSessionAsAdminSchema
    .omit({
      sessionId: true,
    })
    .strict();

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (
    !hasTrustedRequestOrigin(
      request,
    )
  ) {
    return sessionPrivateJson(
      {
        error:
          "UNTRUSTED_ORIGIN",
      },
      {
        status: 403,
      },
    );
  }

  const session =
    await getApiSession(
      request,
    );

  if (
    !session
  ) {
    return sessionPrivateJson(
      {
        error:
          "UNAUTHORIZED",
      },
      {
        status: 401,
      },
    );
  }

  try {
    await requireAdminAccess(
      session.user.id,
      "MANAGE_SESSIONS",
    );
  } catch (error) {
    return adminErrorResponse(
      error,
    );
  }

  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return sessionPrivateJson(
      {
        error:
          "INVALID_JSON",
      },
      {
        status: 400,
      },
    );
  }

  const parsedBody =
    adminBodySchema.safeParse(
      body,
    );

  if (
    !parsedBody.success
  ) {
    return sessionPrivateJson(
      {
        error:
          "INVALID_REQUEST",

        fields:
          parsedBody.error
            .flatten()
            .fieldErrors,
      },
      {
        status: 400,
      },
    );
  }

  const {
    sessionId,
  } =
    await context.params;

  const parsedInput =
    cancelSessionAsAdminSchema
      .safeParse({
        sessionId,

        ...parsedBody.data,
      });

  if (
    !parsedInput.success
  ) {
    return sessionPrivateJson(
      {
        error:
          "INVALID_REQUEST",

        fields:
          parsedInput.error
            .flatten()
            .fieldErrors,
      },
      {
        status: 400,
      },
    );
  }

  try {
    const result =
      await cancelSpeakingSessionAsAdmin(
        session.user.id,
        parsedInput.data,
      );

    return sessionPrivateJson(
      result,
    );
  } catch (error) {
    const response =
      sessionCancellationErrorResponse(
        error,
      );

    if (
      response
    ) {
      return response;
    }

    console.error(
      "Unexpected admin speaking-session cancellation error:",
      error,
    );

    return sessionPrivateJson(
      {
        error:
          "INTERNAL_SERVER_ERROR",
      },
      {
        status: 500,
      },
    );
  }
}
