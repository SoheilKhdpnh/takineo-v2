import {
  getApiSession,
} from "@/lib/auth/api-session";
import {
  serializeSpeakingSessionView,
  sessionReadErrorResponse,
  sessionReadPrivateJson,
} from "@/lib/errors/session-read-http";
import {
  getSpeakingSessionForViewer,
} from "@/lib/services/speaking-session-read.service";
import {
  speakingSessionReadIdSchema,
} from "@/lib/validations/session-read";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type RouteContext = {
  params: Promise<{
    sessionId:
      string;
  }>;
};

export async function GET(
  request:
    Request,
  context:
    RouteContext,
): Promise<Response> {
  const session =
    await getApiSession(
      request,
    );

  if (
    !session
  ) {
    return sessionReadPrivateJson(
      {
        error:
          "UNAUTHORIZED",
      },
      {
        status: 401,
      },
    );
  }

  const {
    sessionId,
  } =
    await context.params;

  const parsedSessionId =
    speakingSessionReadIdSchema
      .safeParse(
        sessionId,
      );

  if (
    !parsedSessionId.success
  ) {
    return sessionReadPrivateJson(
      {
        error:
          "INVALID_REQUEST",

        fields: {
          sessionId:
            parsedSessionId.error
              .issues
              .map(
                (issue) =>
                  issue.message,
              ),
        },
      },
      {
        status: 400,
      },
    );
  }

  try {
    const result =
      await getSpeakingSessionForViewer(
        session.user.id,
        parsedSessionId.data,
      );

    return sessionReadPrivateJson(
      serializeSpeakingSessionView(
        result,
      ),
    );
  } catch (error) {
    const response =
      sessionReadErrorResponse(
        error,
      );

    if (
      response
    ) {
      return response;
    }

    console.error(
      "Unexpected speaking-session detail error:",
      error,
    );

    return sessionReadPrivateJson(
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
