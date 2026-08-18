import {
  bookingPublicJson,
  bookingPublicReadErrorResponse,
} from "@/lib/errors/booking-http";
import {
  getPublicTeacherDetail,
} from "@/lib/services/teacher-discovery.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type TeacherDetailContext = {
  params:
    Promise<{
      teacherProfileId:
        string;
    }>;
};

export async function GET(
  request:
    Request,
  context:
    TeacherDetailContext,
): Promise<Response> {
  const url =
    new URL(
      request.url,
    );

  if (
    [...url.searchParams]
      .length >
    0
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
    const teacher =
      await getPublicTeacherDetail(
        teacherProfileId,
      );

    return bookingPublicJson({
      teacher,
    });
  }
  catch (
    error
  ) {
    return bookingPublicReadErrorResponse(
      error,
    );
  }
}
