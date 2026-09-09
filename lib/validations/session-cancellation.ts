import {
  z,
} from "zod";

import {
  BOOKING_MAX_CANCELLATION_REASON_LENGTH,
} from "@/lib/domain/booking-policy";

const sessionIdentifierSchema =
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

const cancellationReasonSchema =
  z
    .string()
    .min(1)
    .max(
      BOOKING_MAX_CANCELLATION_REASON_LENGTH,
    )
    .refine(
      (value) =>
        value ===
        value.trim(),
      {
        message:
          "Cancellation reason must not contain leading or trailing whitespace.",
      },
    );

export const cancelSessionAsStudentSchema =
  z
    .object({
      sessionId:
        sessionIdentifierSchema,

      reason:
        cancellationReasonSchema
          .optional(),
    })
    .strict();

export const cancelSessionAsTeacherSchema =
  z
    .object({
      sessionId:
        sessionIdentifierSchema,

      reason:
        cancellationReasonSchema,
    })
    .strict();

export const cancelSessionAsAdminSchema =
  z
    .object({
      sessionId:
        sessionIdentifierSchema,

      reason:
        cancellationReasonSchema,
    })
    .strict();

export type CancelSessionAsStudentInput =
  z.infer<
    typeof cancelSessionAsStudentSchema
  >;

export type CancelSessionAsTeacherInput =
  z.infer<
    typeof cancelSessionAsTeacherSchema
  >;

export type CancelSessionAsAdminInput =
  z.infer<
    typeof cancelSessionAsAdminSchema
  >;
