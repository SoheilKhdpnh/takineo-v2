import "server-only";

import {
  BookableSlotsRangeError,
  BookableTeacherNotFoundError,
  BookingConflictError,
  BookingIdempotencyConflictError,
  BookingLimitExceededError,
  BookingSelfBookingError,
  BookingSlotUnavailableError,
  BookingStudentNotEligibleError,
} from "@/lib/errors/booking-errors";
import type {
  SpeakingSessionRecord,
} from "@/lib/services/booking.service";

export function bookingPublicJson(
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
    "no-store",
  );

  return Response.json(
    body,
    {
      ...init,
      headers,
    },
  );
}

export function bookingPrivateJson(
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

export function serializeCreatedBookingSession(
  session:
    SpeakingSessionRecord,
) {
  return {
    id:
      session.id,

    teacherProfileId:
      session.teacherProfileId,

    startAt:
      session.startAt
        .toISOString(),

    endAt:
      session.endAt
        .toISOString(),

    status:
      session.status,
  };
}

function safeUnexpectedBookingError(
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

  return {
    name:
      typeof candidate ===
        "string" &&
      /^[A-Za-z0-9_-]{1,64}$/.test(
        candidate,
      )
        ? candidate
        : "UnknownError",
  };
}

export function bookingPublicReadErrorResponse(
  error:
    unknown,
): Response {
  if (
    error instanceof
    BookableTeacherNotFoundError
  ) {
    return bookingPublicJson(
      {
        error:
          "TEACHER_NOT_FOUND",
      },
      {
        status:
          404,
      },
    );
  }

  if (
    error instanceof
    BookableSlotsRangeError
  ) {
    return bookingPublicJson(
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
    "Unexpected public booking read failure:",
    safeUnexpectedBookingError(
      error,
    ),
  );

  return bookingPublicJson(
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

export function bookingMutationErrorResponse(
  error:
    unknown,
): Response {
  if (
    error instanceof
    BookingStudentNotEligibleError
  ) {
    return bookingPrivateJson(
      {
        error:
          "BOOKING_STUDENT_NOT_ELIGIBLE",
      },
      {
        status:
          403,
      },
    );
  }

  if (
    error instanceof
    BookingSelfBookingError
  ) {
    return bookingPrivateJson(
      {
        error:
          "SELF_BOOKING_FORBIDDEN",
      },
      {
        status:
          403,
      },
    );
  }

  if (
    error instanceof
    BookableTeacherNotFoundError
  ) {
    return bookingPrivateJson(
      {
        error:
          "TEACHER_NOT_FOUND",
      },
      {
        status:
          404,
      },
    );
  }

  if (
    error instanceof
    BookingSlotUnavailableError
  ) {
    return bookingPrivateJson(
      {
        error:
          "SLOT_UNAVAILABLE",
      },
      {
        status:
          409,
      },
    );
  }

  if (
    error instanceof
    BookingLimitExceededError
  ) {
    return bookingPrivateJson(
      {
        error:
          "BOOKING_LIMIT_EXCEEDED",
      },
      {
        status:
          409,
      },
    );
  }

  if (
    error instanceof
    BookingIdempotencyConflictError
  ) {
    return bookingPrivateJson(
      {
        error:
          "IDEMPOTENCY_CONFLICT",
      },
      {
        status:
          409,
      },
    );
  }

  if (
    error instanceof
    BookingConflictError
  ) {
    return bookingPrivateJson(
      {
        error:
          "BOOKING_CONFLICT",
      },
      {
        status:
          409,
      },
    );
  }

  console.error(
    "Unexpected booking creation failure:",
    safeUnexpectedBookingError(
      error,
    ),
  );

  return bookingPrivateJson(
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
