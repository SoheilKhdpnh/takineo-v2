import {
  getApiSession,
} from "@/lib/auth/api-session";
import {
  serializeSpeakingSessionList,
  sessionReadErrorResponse,
  sessionReadPrivateJson,
} from "@/lib/errors/session-read-http";
import {
  listSpeakingSessions,
} from "@/lib/services/speaking-session-read.service";
import {
  listSpeakingSessionsQuerySchema,
} from "@/lib/validations/session-read";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function hasDuplicateSearchParameters(
  searchParams:
    URLSearchParams,
): boolean {
  const seen =
    new Set<string>();

  for (
    const [
      key,
    ] of
    searchParams
  ) {
    if (
      seen.has(
        key,
      )
    ) {
      return true;
    }

    seen.add(
      key,
    );
  }

  return false;
}

export async function GET(
  request:
    Request,
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

  const url =
    new URL(
      request.url,
    );

  if (
    hasDuplicateSearchParameters(
      url.searchParams,
    )
  ) {
    return sessionReadPrivateJson(
      {
        error:
          "INVALID_REQUEST",
      },
      {
        status: 400,
      },
    );
  }

  const parsedQuery =
    listSpeakingSessionsQuerySchema
      .safeParse(
        Object.fromEntries(
          url.searchParams
            .entries(),
        ),
      );

  if (
    !parsedQuery.success
  ) {
    return sessionReadPrivateJson(
      {
        error:
          "INVALID_REQUEST",

        fields:
          parsedQuery.error
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
      await listSpeakingSessions(
        session.user.id,
        parsedQuery.data,
      );

    return sessionReadPrivateJson(
      serializeSpeakingSessionList(
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
      "Unexpected speaking-session list error:",
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
