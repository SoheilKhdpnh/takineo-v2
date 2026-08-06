import { z } from "zod";

import {
  PROFILE_LANGUAGE_CODES,
  PROFILE_TIMEZONES,
} from "@/lib/domain/profile";

export const teacherProfileInputSchema =
  z
    .object({
      headline: z
        .string()
        .trim()
        .min(10)
        .max(120),

      bio: z
        .string()
        .trim()
        .min(80)
        .max(2000),

      experienceYears: z
        .number()
        .int()
        .min(0)
        .max(60),

      nativeLanguage: z.enum(
        PROFILE_LANGUAGE_CODES,
      ),

      teachingLanguage: z.literal("en"),

      timezone: z.enum(PROFILE_TIMEZONES),
    })
    .strict();

export type TeacherProfileInput =
  z.infer<typeof teacherProfileInputSchema>;