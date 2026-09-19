import { z } from "zod";

import { parseAparatVideoUrl } from "@/lib/domain/aparat-video";

export const teacherIntroVideoLinkSchema = z
  .object({
    aparatUrl: z.string().trim().min(1).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (!parseAparatVideoUrl(value.aparatUrl)) {
      context.addIssue({
        code: "custom",
        path: ["aparatUrl"],
        message: "The URL must be an https aparat.com video link.",
      });
    }
  });

export type TeacherIntroVideoLinkInput = z.infer<
  typeof teacherIntroVideoLinkSchema
>;
