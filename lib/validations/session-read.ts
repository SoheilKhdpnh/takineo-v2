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
        z
          .string()
          .min(1)
          .max(2048)
          .optional(),
    })
    .strict();

export type ListSpeakingSessionsInput =
  z.infer<
    typeof listSpeakingSessionsSchema
  >;
