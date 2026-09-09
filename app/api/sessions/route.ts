import {
  getApiSession,
} from "@/lib/auth/api-session";
import {
  bookingMutationErrorResponse,
  bookingPrivateJson,
  serializeCreatedBookingSession,
} from "@/lib/errors/booking-http";
import {
  serializeSpeakingSessionList,
  sessionReadErrorResponse,
  sessionReadPrivateJson,
} from "@/lib/errors/session-read-http";


import {
  listSpeakingSessions,
} from "@/lib/services/speaking-session-read.service";
import {
  createSpeakingSessionSchema,
} from "@/lib/validations/booking";
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
  }
  catch (
    error
  ) {
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
        status:
          500,
      },
    );
  }
}

export async function POST(
  request:
    Request,
): Promise<Response> {
  /*
   * This dependency is mutation-only.
   *
   * Keep it out of module initialization so the existing GET
   * session-read surface remains independently importable and does
   * not require mutation-origin configuration merely to be read.
   */
  const {
    hasTrustedRequestOrigin,
  } =
    await import(
      "@/lib/security/same-origin"
    );

  if (
    !hasTrustedRequestOrigin(
      request,
    )
  ) {
    return bookingPrivateJson(
      {
        error:
          "UNTRUSTED_ORIGIN",
      },
      {
        status:
          403,
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
    return bookingPrivateJson(
      {
        error:
          "UNAUTHORIZED",
      },
      {
        status:
          401,
      },
    );
  }

  let body:
    unknown;

  try {
    body =
      await request.json();
  }
  catch {
    return bookingPrivateJson(
      {
        error:
          "INVALID_JSON",
      },
      {
        status:
          400,
      },
    );
  }

  const parsed =
    createSpeakingSessionSchema
      .safeParse(
        body,
      );

  if (
    !parsed.success
  ) {
    return bookingPrivateJson(
      {
        error:
          "INVALID_REQUEST",

        fields:
          parsed.error
            .flatten()
            .fieldErrors,
      },
      {
        status:
          400,
      },
    );
  }

  try {
    /*
     * Booking persistence is also POST-only. Loading it here keeps
     * GET /api/sessions free from booking-mutation/database module
     * initialization and avoids widening the read route's runtime
     * dependencies.
     */
    const {
      createSpeakingSession,
    } =
      await import(
        "@/lib/services/booking.service"
      );

    const result =
      await createSpeakingSession(
        session.user.id,
        parsed.data,
      );

    return bookingPrivateJson({
      session:
        serializeCreatedBookingSession(
          result,
        ),
    });
  }
  catch (
    error
  ) {
    return bookingMutationErrorResponse(
      error,
    );
  }
}
