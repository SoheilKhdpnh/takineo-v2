import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import { getApiSession } from "@/lib/auth/api-session";
import { hasTrustedRequestOrigin } from "@/lib/security/same-origin";
import {
  getStudentProfileForUser,
  saveStudentProfile,
} from "@/lib/services/student-profile.service";
import { studentProfileInputSchema } from "@/lib/validations/student-profile";

export const runtime = "nodejs";

function profileErrorResponse(
  error: unknown,
): Response {
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
    "Unexpected student profile error:",
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
      await getStudentProfileForUser(
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
    studentProfileInputSchema.safeParse(body);

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
      await saveStudentProfile(
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