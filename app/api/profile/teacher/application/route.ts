import { getApiSession } from "@/lib/auth/api-session";
import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import {
  TeacherApplicationNotReadyError,
  TeacherApplicationStateError,
} from "@/lib/errors/teacher-application-errors";
import {
  hasTrustedRequestOrigin,
} from "@/lib/security/same-origin";
import {
  getTeacherApplicationForUser,
  submitTeacherApplication,
} from "@/lib/services/teacher-application.service";

export const runtime = "nodejs";

function applicationErrorResponse(
  error: unknown,
): Response {
  if (
    error instanceof
    ProfileRoleMismatchError
  ) {
    return Response.json(
      {
        error:
          "FORBIDDEN_PROFILE_TYPE",
      },
      {
        status: 403,
      },
    );
  }

  if (
    error instanceof
    ProfileNotFoundError
  ) {
    return Response.json(
      {
        error: "PROFILE_NOT_FOUND",
      },
      {
        status: 404,
      },
    );
  }

  if (
    error instanceof
    TeacherApplicationNotReadyError
  ) {
    return Response.json(
      {
        error:
          "APPLICATION_NOT_READY",

        reason: error.reason,
      },
      {
        status: 409,
      },
    );
  }

  if (
    error instanceof
    TeacherApplicationStateError
  ) {
    return Response.json(
      {
        error:
          "APPLICATION_STATE_CONFLICT",
      },
      {
        status: 409,
      },
    );
  }

  console.error(
    "Unexpected teacher application error:",
    error,
  );

  return Response.json(
    {
      error:
        "INTERNAL_SERVER_ERROR",
    },
    {
      status: 500,
    },
  );
}

export async function GET(
  request: Request,
): Promise<Response> {
  const session =
    await getApiSession(request);

  if (!session) {
    return Response.json(
      {
        error: "UNAUTHORIZED",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const application =
      await getTeacherApplicationForUser(
        session.user.id,
      );

    return Response.json({
      application,
    });
  } catch (error) {
    return applicationErrorResponse(
      error,
    );
  }
}

export async function POST(
  request: Request,
): Promise<Response> {
  if (
    !hasTrustedRequestOrigin(request)
  ) {
    return Response.json(
      {
        error: "UNTRUSTED_ORIGIN",
      },
      {
        status: 403,
      },
    );
  }

  const session =
    await getApiSession(request);

  if (!session) {
    return Response.json(
      {
        error: "UNAUTHORIZED",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const application =
      await submitTeacherApplication(
        session.user.id,
      );

    return Response.json({
      application,
    });
  } catch (error) {
    return applicationErrorResponse(
      error,
    );
  }
}