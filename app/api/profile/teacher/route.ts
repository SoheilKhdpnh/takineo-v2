import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import { getApiSession } from "@/lib/auth/api-session";
import { hasTrustedRequestOrigin } from "@/lib/security/same-origin";
import {
  getTeacherProfileForUser,
  saveTeacherProfile,
} from "@/lib/services/teacher-profile.service";
import { teacherProfileInputSchema } from "@/lib/validations/teacher-profile";
import { TeacherApplicationLockedError } from "@/lib/errors/teacher-video-errors";

export const runtime = "nodejs";

function profileErrorResponse(
  error: unknown,
): Response {
    if (
    error instanceof
    TeacherApplicationLockedError
  ) {
    return Response.json(
      {
        error: "TEACHER_APPLICATION_LOCKED",
      },
      {
        status: 409,
      },
    );
  }
  if (
    error instanceof ProfileRoleMismatchError
  ) {
    return Response.json(
      {
        error: "FORBIDDEN_PROFILE_TYPE",
      },
      {
        status: 403,
      },
    );
  }

  if (error instanceof ProfileNotFoundError) {
    return Response.json(
      {
        error: "PROFILE_NOT_FOUND",
      },
      {
        status: 404,
      },
    );
  }

  console.error(
    "Unexpected teacher profile error:",
    error,
  );

  return Response.json(
    {
      error: "INTERNAL_SERVER_ERROR",
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
    const profile =
      await getTeacherProfileForUser(
        session.user.id,
      );

    return Response.json({
      profile,
    });
  } catch (error) {
    return profileErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
): Promise<Response> {
  if (!hasTrustedRequestOrigin(request)) {
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: "INVALID_JSON",
      },
      {
        status: 400,
      },
    );
  }

  const validationResult =
    teacherProfileInputSchema.safeParse(body);

  if (!validationResult.success) {
    return Response.json(
      {
        error: "INVALID_PROFILE_DATA",
        fields:
          validationResult.error.flatten()
            .fieldErrors,
      },
      {
        status: 400,
      },
    );
  }

  try {
    const profile =
      await saveTeacherProfile(
        session.user.id,
        validationResult.data,
      );

    return Response.json({
      profile,
    });
  } catch (error) {
    return profileErrorResponse(error);
  }
}