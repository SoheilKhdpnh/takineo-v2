import {
  z,
} from "zod";

const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

const opaqueIdentifierSchema =
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
          "Identifier must not contain whitespace.",
      },
    );

export const createSpeakingSessionSchema =
  z
    .object({
      teacherProfileId:
        opaqueIdentifierSchema,

      startAt:
        z
          .string()
          .regex(
            ISO_INSTANT_PATTERN,
            {
              message:
                "startAt must be an ISO timestamp with an explicit timezone.",
            },
          )
          .refine(
            (value) => {
              const instant =
                new Date(
                  value,
                );

              return (
                !Number.isNaN(
                  instant.getTime(),
                ) &&
                instant.getUTCSeconds() ===
                  0 &&
                instant.getUTCMilliseconds() ===
                  0 &&
                instant.getUTCMinutes() %
                  15 ===
                  0
              );
            },
            {
              message:
                "startAt must align exactly to a 15-minute boundary.",
            },
          ),

      idempotencyKey:
        z
          .string()
          .min(16)
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
                "Idempotency key must not contain whitespace.",
            },
          ),
    })
    .strict();

export type CreateSpeakingSessionInput =
  z.infer<
    typeof createSpeakingSessionSchema
  >;
