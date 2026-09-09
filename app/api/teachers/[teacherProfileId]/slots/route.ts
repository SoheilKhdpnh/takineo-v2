import {
  bookingPublicJson,
  bookingPublicReadErrorResponse,
} from "@/lib/errors/booking-http";
import {
  getBookableSlotsForTeacher,
} from "@/lib/services/bookable-slots.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type TeacherSlotsContext = {
  params:
    Promise<{
      teacherProfileId:
        string;
    }>;
};

const allowedQueryKeys =
  new Set([
    "fromDate",
    "toDate",
  ]);

function parseRange(
  request:
    Request,
):
  | {
      fromDate:
        string;

      toDate:
        string;
    }
  | null {
  const params =
    new URL(
      request.url,
    ).searchParams;

  const seen =
    new Set<
      string
    >();

  for (
    const [
      key,
    ]
    of params
  ) {
    if (
      !allowedQueryKeys.has(
        key,
      ) ||
      seen.has(
        key,
      )
    ) {
      return null;
    }

    seen.add(
      key,
    );
  }

  const fromDate =
    params.get(
      "fromDate",
    );

  const toDate =
    params.get(
      "toDate",
    );

  if (
    !fromDate ||
    !toDate
  ) {
    return null;
  }

  return {
    fromDate,
    toDate,
  };
}

export async function GET(
  request:
    Request,
  context:
    TeacherSlotsContext,
): Promise<Response> {
  const range =
    parseRange(
      request,
    );

  if (
    !range
  ) {
    return bookingPublicJson(
      {
        error:
          "INVALID_REQUEST",
      },
      {
        status:
          400,
      },
    );
  }

  const {
    teacherProfileId,
  } =
    await context.params;

  try {
    const result =
      await getBookableSlotsForTeacher(
        teacherProfileId,
        range,
      );

    return bookingPublicJson(
      result,
    );
  }
  catch (
    error
  ) {
    return bookingPublicReadErrorResponse(
      error,
    );
  }
}
