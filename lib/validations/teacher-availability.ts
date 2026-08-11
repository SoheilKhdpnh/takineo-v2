import {
  z,
} from "zod";

import {
  AVAILABILITY_EXCEPTION_TYPES,
  BOOKING_WEEKDAYS,
  intervalsOverlap,
  isBookingDateKey,
} from "@/lib/domain/booking";
import {
  BOOKING_MAX_EXCEPTION_NOTE_LENGTH,
  BOOKING_MAX_WEEKLY_AVAILABILITY_RULES,
} from "@/lib/domain/booking-policy";

const minuteSchema =
  z
    .number()
    .int()
    .min(0)
    .max(1440)
    .refine(
      (value) =>
        value % 15 === 0,
      {
        message:
          "Minute must align to a 15-minute boundary.",
      },
    );

export const teacherAvailabilityRuleSchema =
  z
    .object({
      weekday:
        z.enum(
          BOOKING_WEEKDAYS,
        ),

      startMinute:
        minuteSchema,

      endMinute:
        minuteSchema,

      isActive:
        z.boolean().default(
          true,
        ),
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.startMinute >=
          value.endMinute
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "endMinute",
            ],
            message:
              "End minute must be after start minute.",
          });
        }
      },
    );

export const replaceTeacherAvailabilitySchema =
  z
    .object({
      rules:
        z
          .array(
            teacherAvailabilityRuleSchema,
          )
          .max(
            BOOKING_MAX_WEEKLY_AVAILABILITY_RULES,
          ),
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        const exactWindows =
          new Set<string>();

        for (
          const rule
          of value.rules
        ) {
          const key =
            `${rule.weekday}:${rule.startMinute}:${rule.endMinute}`;

          if (
            exactWindows.has(
              key,
            )
          ) {
            context.addIssue({
              code: "custom",
              path: [
                "rules",
              ],
              message:
                "Duplicate availability windows are not allowed.",
            });

            return;
          }

          exactWindows.add(
            key,
          );
        }

        const activeRules =
          value.rules.filter(
            (rule) =>
              rule.isActive,
          );

        for (
          let firstIndex = 0;
          firstIndex <
          activeRules.length;
          firstIndex += 1
        ) {
          const first =
            activeRules[
              firstIndex
            ];

          if (!first) {
            continue;
          }

          for (
            let secondIndex =
              firstIndex + 1;
            secondIndex <
            activeRules.length;
            secondIndex += 1
          ) {
            const second =
              activeRules[
                secondIndex
              ];

            if (
              !second ||
              first.weekday !==
                second.weekday
            ) {
              continue;
            }

            if (
              intervalsOverlap(
                first,
                second,
              )
            ) {
              context.addIssue({
                code: "custom",
                path: [
                  "rules",
                ],
                message:
                  "Active availability windows may not overlap.",
              });

              return;
            }
          }
        }
      },
    );

export const teacherAvailabilityExceptionSchema =
  z
    .object({
      date:
        z
          .string()
          .refine(
            isBookingDateKey,
            {
              message:
                "Invalid booking date.",
            },
          ),

      startMinute:
        minuteSchema,

      endMinute:
        minuteSchema,

      type:
        z.enum(
          AVAILABILITY_EXCEPTION_TYPES,
        ),

      note:
        z
          .string()
          .trim()
          .min(1)
          .max(
            BOOKING_MAX_EXCEPTION_NOTE_LENGTH,
          )
          .optional(),
    })
    .strict()
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.startMinute >=
          value.endMinute
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "endMinute",
            ],
            message:
              "End minute must be after start minute.",
          });
        }
      },
    );

export type TeacherAvailabilityRuleInput =
  z.infer<
    typeof teacherAvailabilityRuleSchema
  >;

export type ReplaceTeacherAvailabilityInput =
  z.infer<
    typeof replaceTeacherAvailabilitySchema
  >;

export type TeacherAvailabilityExceptionInput =
  z.infer<
    typeof teacherAvailabilityExceptionSchema
  >;
