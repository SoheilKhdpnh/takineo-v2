import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import {
  TeacherAvailabilityConflictError,
  TeacherAvailabilityExceptionNotFoundError,
  TeacherAvailabilityRangeError,
  TeacherAvailabilityStateError,
} from "@/lib/errors/teacher-availability-errors";

export function teacherAvailabilityPrivateJson(
  body:
    unknown,
  init:
    ResponseInit = {},
): Response {
  const headers =
    new Headers(
      init.headers,
    );

  headers.set(
    "Cache-Control",
    "private, no-store",
  );

  return Response.json(
    body,
    {
      ...init,
      headers,
    },
  );
}

function safeUnexpectedAvailabilityError(
  error:
    unknown,
): {
  name:
    string;
} {
  const candidate =
    error instanceof Error
      ? error.name
      : null;

  const name =
    typeof candidate ===
      "string" &&
    /^[A-Za-z0-9_-]{1,64}$/.test(
      candidate,
    )
      ? candidate
      : "UnknownError";

  return {
    name,
  };
}

export function teacherAvailabilityErrorResponse(
  error:
    unknown,
): Response {
  if (
    error instanceof
    ProfileRoleMismatchError
  ) {
    return teacherAvailabilityPrivateJson(
      {
        error:
          "FORBIDDEN_PROFILE_TYPE",
      },
      {
        status:
          403,
      },
    );
  }

  if (
    error instanceof
    ProfileNotFoundError
  ) {
    return teacherAvailabilityPrivateJson(
      {
        error:
          "PROFILE_NOT_FOUND",
      },
      {
        status:
          404,
      },
    );
  }

  if (
    error instanceof
    TeacherAvailabilityStateError
  ) {
    return teacherAvailabilityPrivateJson(
      {
        error:
          "TEACHER_AVAILABILITY_STATE_CONFLICT",
      },
      {
        status:
          409,
      },
    );
  }

  if (
    error instanceof
    TeacherAvailabilityConflictError
  ) {
    return teacherAvailabilityPrivateJson(
      {
        error:
          "TEACHER_AVAILABILITY_CONFLICT",
      },
      {
        status:
          409,
      },
    );
  }

  if (
    error instanceof
    TeacherAvailabilityExceptionNotFoundError
  ) {
    return teacherAvailabilityPrivateJson(
      {
        error:
          "TEACHER_AVAILABILITY_EXCEPTION_NOT_FOUND",
      },
      {
        status:
          404,
      },
    );
  }

  if (
    error instanceof
    TeacherAvailabilityRangeError
  ) {
    return teacherAvailabilityPrivateJson(
      {
        error:
          error.reason,
      },
      {
        status:
          400,
      },
    );
  }

  console.error(
    "Unexpected teacher availability error:",
    safeUnexpectedAvailabilityError(
      error,
    ),
  );

  return teacherAvailabilityPrivateJson(
    {
      error:
        "INTERNAL_SERVER_ERROR",
    },
    {
      status:
        500,
    },
  );
}
