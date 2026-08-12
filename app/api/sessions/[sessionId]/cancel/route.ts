import {
  getUserAccessContext,
} from "@/lib/auth/access";
import {
  getApiSession,
} from "@/lib/auth/api-session";
import {
  sessionCancellationErrorResponse,
  sessionPrivateJson,
} from "@/lib/errors/session-cancellation-http";
import {
  hasTrustedRequestOrigin,
} from "@/lib/security/same-origin";
import {
  cancelSpeakingSessionAsStudent,
  cancelSpeakingSessionAsTeacher,
} from "@/lib/services/session-cancellation.service";
import {
  cancelSessionAsStudentSchema,
  cancelSessionAsTeacherSchema,
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

const studentBodySchema =
  cancelSessionAsStudentSchema
    .omit({
      sessionId: true,
    })
    .strict();

const teacherBodySchema =
  cancelSessionAsTeacherSchema
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

  const access =
    await getUserAccessContext(
      session.user.id,
    );

  if (
    !access ||
    access.accountStatus !==
      "ACTIVE"
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

  if (
    access.role !==
      "STUDENT" &&
    access.role !==
      "TEACHER"
  ) {
    return sessionPrivateJson(
      {
        error:
          "SESSION_CANCELLATION_FORBIDDEN",
      },
      {
        status: 403,
      },
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

  const {
    sessionId,
  } =
    await context.params;

  if (
    access.role ===
    "STUDENT"
  ) {
    const parsedBody =
      studentBodySchema.safeParse(
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

    const parsedInput =
      cancelSessionAsStudentSchema
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
        await cancelSpeakingSessionAsStudent(
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
        "Unexpected student speaking-session cancellation error:",
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

  const parsedBody =
    teacherBodySchema.safeParse(
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

  const parsedInput =
    cancelSessionAsTeacherSchema
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
      await cancelSpeakingSessionAsTeacher(
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
      "Unexpected teacher speaking-session cancellation error:",
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
