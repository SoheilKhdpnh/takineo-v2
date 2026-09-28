import { z } from "zod";

import {
  PROFILE_LANGUAGE_CODES,
  PROFILE_TIMEZONES,
} from "@/lib/domain/profile";

const teacherCertificationInputSchema = z
  .object({
    subject: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(160),
  })
  .strict();

const teacherEducationInputSchema = z
  .object({
    university: z.string().trim().min(1).max(160),
    degree: z.string().trim().min(1).max(160),
    degreeType: z.string().trim().min(1).max(60),
    specialization: z.string().trim().min(1).max(160),
    startYear: z.number().int().min(1950).max(2100),
    endYear: z
      .number()
      .int()
      .min(1950)
      .max(2100)
      .nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.endYear !== null &&
      value.endYear < value.startYear
    ) {
      context.addIssue({
        code: "custom",
        path: ["endYear"],
        message: "endYear must be >= startYear",
      });
    }
  });

export const teacherProfileInputSchema = z
  .object({
    headline: z.string().trim().min(10).max(120),
    bio: z.string().trim().min(80).max(2000),
    experienceYears: z.number().int().min(0).max(60),
    nativeLanguage: z.enum(PROFILE_LANGUAGE_CODES),
    teachingLanguage: z.literal("en"),
    timezone: z.enum(PROFILE_TIMEZONES),
    certifications: z
      .array(teacherCertificationInputSchema)
      .max(20)
      .optional(),
    education: z
      .array(teacherEducationInputSchema)
      .max(20)
      .optional(),
  })
  .strict();

export type TeacherProfileInput = z.infer<
  typeof teacherProfileInputSchema
>;
