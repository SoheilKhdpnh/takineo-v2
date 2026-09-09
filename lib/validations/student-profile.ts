import { z } from "zod";

import {
  ENGLISH_LEVELS,
  PROFILE_LANGUAGE_CODES,
  PROFILE_TIMEZONES,
} from "@/lib/domain/profile";

export const studentProfileInputSchema =
  z
    .object({
      englishLevel: z.enum(ENGLISH_LEVELS),

      learningGoal: z
        .string()
        .trim()
        .min(10)
        .max(500),

      nativeLanguage: z.enum(
        PROFILE_LANGUAGE_CODES,
      ),

      timezone: z.enum(PROFILE_TIMEZONES),
    })
    .strict();

export type StudentProfileInput =
  z.infer<typeof studentProfileInputSchema>;