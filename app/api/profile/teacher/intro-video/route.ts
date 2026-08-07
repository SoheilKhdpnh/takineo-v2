import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import {
  TeacherApplicationLockedError,
  TeacherProfileIncompleteError,
} from "@/lib/errors/teacher-video-errors";
import { getApiSession } from "@/lib/auth/api-session";
import { hasTrustedRequestOrigin } from "@/lib/security/same-origin";
import {
  createTeacherIntroVideoUpload,
  getTeacherIntroVideoState,
} from "@/lib/services/teacher-intro-video.service";
import {
  MuxConfigurationError,
} from "@/lib/video/mux-config";

export const runtime = "nodejs";

function videoErrorResponse(
  error: unknown,
): Response {
  if (
    error instanceof
    ProfileRoleMismatchError
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

  if (
    error instanceof ProfileNotFoundError
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
    TeacherProfileIncompleteError
  ) {
    return Response.json(
      {
        error: "TEACHER_PROFILE_INCOMPLETE",
      },
      {
        status: 409,
      },
    );
  }

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
    error instanceof MuxConfigurationError
  ) {
    console.error(error);

    return Response.json(
      {
        error: "VIDEO_PROVIDER_UNAVAILABLE",
      },
      {
        status: 503,
      },
    );
  }

  console.error(
    "Unexpected teacher video error:",
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
    const state =
      await getTeacherIntroVideoState(
        session.user.id,
      );

    return Response.json(state);
  } catch (error) {
    return videoErrorResponse(error);
  }
}

export async function POST(
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

  try {
    const result =
      await createTeacherIntroVideoUpload(
        session.user.id,
      );

    return Response.json(result, {
      status: 201,
    });
  } catch (error) {
    return videoErrorResponse(error);
  }
}