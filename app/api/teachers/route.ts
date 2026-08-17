import {
  BookableSlotsRangeError,
} from "@/lib/errors/booking-errors";
import {
  listPublicTeachers,
  TEACHER_DISCOVERY_MAX_PAGE_SIZE,
} from "@/lib/services/teacher-discovery.service";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const DEFAULT_PAGE_SIZE =
  20;


const ALLOWED_QUERY_PARAMETERS =
  new Set([
    "fromDate",
    "toDate",
    "limit",
    "cursor",
  ]);

type ParsedDiscoveryQuery = {
  fromDate:
    string;

  toDate:
    string;

  limit:
    number;

  cursor?:
    string;
};

function publicJson(
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

function invalidRequest():
  Response {
  return publicJson(
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

/*
 * Public discovery uses deliberately strict query parsing.
 *
 * In particular, URLSearchParams -> Object.fromEntries() is
 * intentionally avoided because it silently collapses duplicate
 * parameters and would make inputs such as:
 *
 *   ?limit=20&limit=40
 *
 * ambiguous.
 */
function parseDiscoveryQuery(
  request:
    Request,
):
  ParsedDiscoveryQuery |
  null {
  const url =
    new URL(
      request.url,
    );

  const params =
    url.searchParams;

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
      !ALLOWED_QUERY_PARAMETERS
        .has(
          key,
        )
    ) {
      return null;
    }

    if (
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

  const rawLimit =
    params.get(
      "limit",
    );

  let limit =
    DEFAULT_PAGE_SIZE;

  if (
    rawLimit !==
    null
  ) {
    /*
     * Decimal, signed, padded-with-space, NaN-like, and
     * exponential representations are rejected instead of
     * relying on permissive Number() coercion.
     */
    if (
      !/^[0-9]+$/.test(
        rawLimit,
      )
    ) {
      return null;
    }

    limit =
      Number(
        rawLimit,
      );

    if (
      !Number.isSafeInteger(
        limit,
      ) ||
      limit < 1 ||
      limit >
        TEACHER_DISCOVERY_MAX_PAGE_SIZE
    ) {
      return null;
    }
  }

  const rawCursor =
    params.get(
      "cursor",
    );

  if (
    rawCursor !==
      null &&
    (
      rawCursor.length ===
        0 ||
      rawCursor !==
        rawCursor.trim()
    )
  ) {
    return null;
  }

  return {
    fromDate,
    toDate,
    limit,

    ...(
      rawCursor !==
        null
        ? {
            cursor:
              rawCursor,
          }
        : {}
    ),
  };
}

export async function GET(
  request:
    Request,
): Promise<Response> {
  const parsed =
    parseDiscoveryQuery(
      request,
    );

  if (!parsed) {
    return invalidRequest();
  }

  try {
    const result =
      await listPublicTeachers(
        parsed,
      );

    /*
     * Response.json uses JSON serialization at the HTTP boundary,
     * therefore Date-valued nextAvailableAt fields become canonical
     * ISO-8601 strings.
     */
    return publicJson(
      result,
    );
  }
  catch (
    error
  ) {
    if (
      error instanceof
      BookableSlotsRangeError
    ) {
      return publicJson(
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

    /*
     * Public failures deliberately do not echo exception messages.
     * Database URLs, provider details, SQL text, credentials, or
     * other internal diagnostics must never enter this response.
     */
    console.error(
      "Unexpected public teacher discovery failure.",
    );

    return publicJson(
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
}
