import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import { getApiSession } from "@/lib/auth/api-session";
import { hasTrustedRequestOrigin } from "@/lib/security/same-origin";
import { updateAuthenticatedUserPhoto } from "@/lib/services/profile-photo.service";
import { profilePhotoInputSchema } from "@/lib/validations/profile-photo";

export const runtime = "nodejs";

function mapError(error: unknown): Response {
  if (error instanceof ProfileRoleMismatchError) {
    return Response.json(
      { error: "FORBIDDEN_PROFILE_TYPE" },
      { status: 403 },
    );
  }

  if (error instanceof ProfileNotFoundError) {
    return Response.json(
      { error: "PROFILE_NOT_FOUND" },
      { status: 404 },
    );
  }

  console.error("Unexpected profile photo error:", error);

  return Response.json(
    { error: "INTERNAL_SERVER_ERROR" },
    { status: 500 },
  );
}

export async function PUT(request: Request): Promise<Response> {
  if (!hasTrustedRequestOrigin(request)) {
    return Response.json(
      { error: "UNTRUSTED_ORIGIN" },
      { status: 403 },
    );
  }

  const session = await getApiSession(request);

  if (!session) {
    return Response.json(
      { error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const validation = profilePhotoInputSchema.safeParse(body);

  if (!validation.success) {
    return Response.json(
      {
        error: "INVALID_PHOTO",
        fields: validation.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const result = await updateAuthenticatedUserPhoto(
      session.user.id,
      validation.data,
    );

    return Response.json({ image: result.image });
  } catch (error) {
    return mapError(error);
  }
}
