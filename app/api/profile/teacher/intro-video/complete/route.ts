import { z } from "zod";

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
  markTeacherIntroVideoUploadComplete,
} from "@/lib/services/teacher-intro-video.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  uploadId: z
    .string()
    .trim()
    .min(1)
    .max(255),
});

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

  const parsed =
    bodySchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "INVALID_REQUEST",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const state =
      await markTeacherIntroVideoUploadComplete(
        session.user.id,
        parsed.data.uploadId,
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

    console.error(
      "Unable to mark teacher video upload complete:",
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
}