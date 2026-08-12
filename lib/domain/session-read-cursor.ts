import "server-only";

import {
  z,
} from "zod";

import {
  SessionReadCursorError,
} from "@/lib/errors/session-read-errors";
import {
  SESSION_READ_BUCKETS,
  type SessionReadBucket,
} from "@/lib/domain/session-read-policy";

const SESSION_READ_CURSOR_VERSION =
  1 as const;

const MAX_CURSOR_LENGTH =
  2048;

const cursorPayloadSchema =
  z
    .object({
      v:
        z.literal(
          SESSION_READ_CURSOR_VERSION,
        ),

      bucket:
        z.enum(
          SESSION_READ_BUCKETS,
        ),

      asOf:
        z
          .string()
          .datetime({
            offset:
              true,
          }),

      startAt:
        z
          .string()
          .datetime({
            offset:
              true,
          }),

      id:
        z
          .string()
          .min(1)
          .max(128)
          .refine(
            (value) =>
              value ===
                value.trim() &&
              !/\s/.test(
                value,
              ),
            {
              message:
                "Cursor session ID must not contain whitespace.",
            },
          ),
    })
    .strict();

export type SessionReadCursor = {
  bucket:
    SessionReadBucket;

  asOf:
    Date;

  startAt:
    Date;

  id:
    string;
};

function assertValidDate(
  value: Date,
): void {
  if (
    Number.isNaN(
      value.getTime(),
    )
  ) {
    throw new SessionReadCursorError();
  }
}

export function encodeSessionReadCursor(
  cursor:
    SessionReadCursor,
): string {
  assertValidDate(
    cursor.asOf,
  );

  assertValidDate(
    cursor.startAt,
  );

  const parsed =
    cursorPayloadSchema.safeParse({
      v:
        SESSION_READ_CURSOR_VERSION,

      bucket:
        cursor.bucket,

      asOf:
        cursor.asOf.toISOString(),

      startAt:
        cursor.startAt.toISOString(),

      id:
        cursor.id,
    });

  if (
    !parsed.success
  ) {
    throw new SessionReadCursorError();
  }

  return Buffer
    .from(
      JSON.stringify(
        parsed.data,
      ),
      "utf8",
    )
    .toString(
      "base64url",
    );
}

export function decodeSessionReadCursor(
  encoded:
    string,
  expectedBucket:
    SessionReadBucket,
): SessionReadCursor {
  if (
    encoded.length < 1 ||
    encoded.length >
      MAX_CURSOR_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(
      encoded,
    )
  ) {
    throw new SessionReadCursorError();
  }

  let decoded:
    Buffer;

  try {
    decoded =
      Buffer.from(
        encoded,
        "base64url",
      );
  } catch {
    throw new SessionReadCursorError();
  }

  if (
    decoded.toString(
      "base64url",
    ) !==
    encoded
  ) {
    throw new SessionReadCursorError();
  }

  let payload:
    unknown;

  try {
    payload =
      JSON.parse(
        decoded.toString(
          "utf8",
        ),
      );
  } catch {
    throw new SessionReadCursorError();
  }

  const parsed =
    cursorPayloadSchema.safeParse(
      payload,
    );

  if (
    !parsed.success ||
    parsed.data.bucket !==
      expectedBucket
  ) {
    throw new SessionReadCursorError();
  }

  const asOf =
    new Date(
      parsed.data.asOf,
    );

  const startAt =
    new Date(
      parsed.data.startAt,
    );

  assertValidDate(
    asOf,
  );

  assertValidDate(
    startAt,
  );

  return {
    bucket:
      parsed.data.bucket,

    asOf,

    startAt,

    id:
      parsed.data.id,
  };
}
