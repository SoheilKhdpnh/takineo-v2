import { getApiSession } from "@/lib/auth/api-session";
import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import {
  TeacherVideoNotFoundError,
} from "@/lib/errors/teacher-video-errors";
import {
  hasTrustedRequestOrigin,
} from "@/lib/security/same-origin";
import {
  syncTeacherIntroVideoFromMux,
} from "@/lib/services/teacher-intro-video.service";
import {
  MuxConfigurationError,
} from "@/lib/video/mux-config";

export const runtime = "nodejs";

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
    const state =
      await syncTeacherIntroVideoFromMux(
        session.user.id,
      );

    return Response.json(state);
  } catch (error) {
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
        ProfileNotFoundError ||
      error instanceof
        TeacherVideoNotFoundError
    ) {
      return Response.json(
        {
          error: "VIDEO_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    if (
      error instanceof
      MuxConfigurationError
    ) {
      return Response.json(
        {
          error:
            "VIDEO_PROVIDER_UNAVAILABLE",
        },
        {
          status: 503,
        },
      );
    }

    console.error(
      "Teacher video Mux sync failed:",
      error,
    );

    return Response.json(
      {
        error: "VIDEO_SYNC_FAILED",
      },
      {
        status: 502,
      },
    );
  }
}