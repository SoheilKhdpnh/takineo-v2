import {
  z,
} from "zod";

import {
  SESSION_READ_BUCKETS,
} from "@/lib/domain/session-read-policy";

export const SESSION_READ_DEFAULT_LIMIT =
  20;

export const SESSION_READ_MAX_LIMIT =
  100;

export const SESSION_READ_MAX_CURSOR_LENGTH =
  2048;

const sessionReadCursorInputSchema =
  z
    .string()
    .min(1)
    .max(
      SESSION_READ_MAX_CURSOR_LENGTH,
    );

export const speakingSessionReadIdSchema =
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
          "Session identifier must not contain whitespace.",
      },
    );

export const listSpeakingSessionsSchema =
  z
    .object({
      bucket:
        z.enum(
          SESSION_READ_BUCKETS,
        ),

      limit:
        z
          .number()
          .int()
          .min(1)
          .max(
            SESSION_READ_MAX_LIMIT,
          )
          .default(
            SESSION_READ_DEFAULT_LIMIT,
          ),

      cursor:
        sessionReadCursorInputSchema
          .optional(),
    })
    .strict();

const sessionReadLimitQuerySchema =
  z.preprocess(
    (value) => {
      if (
        value ===
        undefined
      ) {
        return SESSION_READ_DEFAULT_LIMIT;
      }

      if (
        typeof value ===
          "string" &&
        /^[1-9]\d{0,2}$/.test(
          value,
        )
      ) {
        return Number(
          value,
        );
      }

      return value;
    },
    z
      .number()
      .int()
      .min(1)
      .max(
        SESSION_READ_MAX_LIMIT,
      ),
  );

export const listSpeakingSessionsQuerySchema =
  z
    .object({
      bucket:
        z.enum(
          SESSION_READ_BUCKETS,
        ),

      limit:
        sessionReadLimitQuerySchema,

      cursor:
        sessionReadCursorInputSchema
          .optional(),
    })
    .strict();

export type ListSpeakingSessionsInput =
  z.infer<
    typeof listSpeakingSessionsSchema
  >;
