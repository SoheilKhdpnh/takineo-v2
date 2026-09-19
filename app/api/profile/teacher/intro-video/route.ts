import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import {
  TeacherApplicationLockedError,
  TeacherProfileIncompleteError,
  TeacherVideoInvalidAparatUrlError,
} from "@/lib/errors/teacher-video-errors";
import { getApiSession } from "@/lib/auth/api-session";
import { hasTrustedRequestOrigin } from "@/lib/security/same-origin";
import {
  getTeacherIntroVideoState,
  submitTeacherIntroVideoLink,
} from "@/lib/services/teacher-intro-video.service";
import { teacherIntroVideoLinkSchema } from "@/lib/validations/teacher-intro-video";

export const runtime = "nodejs";

function videoErrorResponse(error: unknown): Response {
  if (error instanceof ProfileRoleMismatchError) {
    return Response.json({ error: "FORBIDDEN_PROFILE_TYPE" }, { status: 403 });
  }

  if (error instanceof ProfileNotFoundError) {
    return Response.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 });
  }

  if (error instanceof TeacherProfileIncompleteError) {
    return Response.json(
      { error: "TEACHER_PROFILE_INCOMPLETE" },
      { status: 409 },
    );
  }

  if (error instanceof TeacherApplicationLockedError) {
    return Response.json(
      { error: "TEACHER_APPLICATION_LOCKED" },
      { status: 409 },
    );
  }

  if (error instanceof TeacherVideoInvalidAparatUrlError) {
    return Response.json({ error: "INVALID_APARAT_URL" }, { status: 400 });
  }

  console.error("Unexpected teacher video error:", error);

  return Response.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
}

export async function GET(request: Request): Promise<Response> {
  const session = await getApiSession(request);

  if (!session) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    return Response.json(await getTeacherIntroVideoState(session.user.id));
  } catch (error) {
    return videoErrorResponse(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!hasTrustedRequestOrigin(request)) {
    return Response.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getApiSession(request);

  if (!session) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = teacherIntroVideoLinkSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: "INVALID_APARAT_URL",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const result = await submitTeacherIntroVideoLink(
      session.user.id,
      parsed.data.aparatUrl,
    );

    return Response.json(result);
  } catch (error) {
    return videoErrorResponse(error);
  }
}
