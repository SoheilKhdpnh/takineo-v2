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
  createTeacherAvailabilityException,
  getTeacherAvailabilityForUser,
  replaceTeacherWeeklyAvailability,
} from "@/lib/services/teacher-availability.service";
import {
  replaceTeacherAvailabilitySchema,
  teacherAvailabilityExceptionSchema,
} from "@/lib/validations/teacher-availability";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type AvailabilityReadQuery = {
  fromDate:
    string;

  toDate:
    string;
};

const ALLOWED_READ_QUERY_KEYS =
  new Set([
    "fromDate",
    "toDate",
  ]);

function parseReadQuery(
  request:
    Request,
):
  AvailabilityReadQuery |
  null {
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
      !ALLOWED_READ_QUERY_KEYS.has(
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
    fromDate ===
      null ||
    fromDate.length ===
      0 ||
    toDate ===
      null ||
    toDate.length ===
      0
  ) {
    return null;
  }

  return {
    fromDate,
    toDate,
  };
}

function unauthorized():
  Response {
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

function untrustedOrigin():
  Response {
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

function invalidRequest(
  fields?:
    unknown,
): Response {
  return teacherAvailabilityPrivateJson(
    {
      error:
        "INVALID_REQUEST",

      ...(
        fields !==
          undefined
          ? {
              fields,
            }
          : {}
      ),
    },
    {
      status:
        400,
    },
  );
}

export async function GET(
  request:
    Request,
): Promise<Response> {
  const session =
    await getApiSession(
      request,
    );

  if (!session) {
    return unauthorized();
  }

  const range =
    parseReadQuery(
      request,
    );

  if (!range) {
    return invalidRequest();
  }

  try {
    const availability =
      await getTeacherAvailabilityForUser(
        session.user.id,
        range,
      );

    return teacherAvailabilityPrivateJson({
      availability,
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

export async function PUT(
  request:
    Request,
): Promise<Response> {
  if (
    !hasTrustedRequestOrigin(
      request,
    )
  ) {
    return untrustedOrigin();
  }

  const session =
    await getApiSession(
      request,
    );

  if (!session) {
    return unauthorized();
  }

  let body:
    unknown;

  try {
    body =
      await request.json();
  }
  catch {
    return teacherAvailabilityPrivateJson(
      {
        error:
          "INVALID_JSON",
      },
      {
        status:
          400,
      },
    );
  }

  const parsed =
    replaceTeacherAvailabilitySchema.safeParse(
      body,
    );

  if (
    !parsed.success
  ) {
    return invalidRequest(
      parsed.error
        .flatten()
        .fieldErrors,
    );
  }

  try {
    const rules =
      await replaceTeacherWeeklyAvailability(
        session.user.id,
        parsed.data,
      );

    return teacherAvailabilityPrivateJson({
      rules,
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

export async function POST(
  request:
    Request,
): Promise<Response> {
  if (
    !hasTrustedRequestOrigin(
      request,
    )
  ) {
    return untrustedOrigin();
  }

  const session =
    await getApiSession(
      request,
    );

  if (!session) {
    return unauthorized();
  }

  let body:
    unknown;

  try {
    body =
      await request.json();
  }
  catch {
    return teacherAvailabilityPrivateJson(
      {
        error:
          "INVALID_JSON",
      },
      {
        status:
          400,
      },
    );
  }

  const parsed =
    teacherAvailabilityExceptionSchema.safeParse(
      body,
    );

  if (
    !parsed.success
  ) {
    return invalidRequest(
      parsed.error
        .flatten()
        .fieldErrors,
    );
  }

  try {
    const exception =
      await createTeacherAvailabilityException(
        session.user.id,
        parsed.data,
      );

    return teacherAvailabilityPrivateJson(
      {
        exception,
      },
      {
        status:
          201,
      },
    );
  }
  catch (
    error
  ) {
    return teacherAvailabilityErrorResponse(
      error,
    );
  }
}
