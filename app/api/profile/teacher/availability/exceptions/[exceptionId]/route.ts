import {
  getApiSession,
} from "@/lib/auth/api-session";
import {
  teacherAvailabilityErrorResponse,
  teacherAvailabilityPrivateJson,
} from "@/lib/errors/teacher-availability-http";
import {
  hasTrustedRequestOrigin,
} from "@/lib/security/same-origin";
import {
  deleteTeacherAvailabilityException,
} from "@/lib/services/teacher-availability.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type DeleteRouteContext = {
  params:
    Promise<{
      exceptionId:
        string;
    }>;
};

export async function DELETE(
  request:
    Request,
  context:
    DeleteRouteContext,
): Promise<Response> {
  if (
    !hasTrustedRequestOrigin(
      request,
    )
  ) {
    return teacherAvailabilityPrivateJson(
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

  if (!session) {
    return teacherAvailabilityPrivateJson(
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

  const {
    exceptionId,
  } =
    await context.params;

  try {
    await deleteTeacherAvailabilityException(
      session.user.id,
      exceptionId,
    );

    return teacherAvailabilityPrivateJson({
      deleted:
        true,
    });
  }
  catch (
    error
  ) {
    return teacherAvailabilityErrorResponse(
      error,
    );
  }
}
