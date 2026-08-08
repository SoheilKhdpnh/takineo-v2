import { z } from "zod";

export const adminQueueQuerySchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

const staleGuardSchema = z.object({
  reviewCycle: z.number().int().positive(),
  profileRevision: z.number().int().positive(),
  videoId: z.string().cuid(),
  videoRevision: z.number().int().positive(),
}).strict();

export const adminApplicationIdSchema = z.string().cuid();
export const adminEmptyBodySchema = z.literal("");

export const approveApplicationSchema = staleGuardSchema;

export const rejectApplicationSchema = staleGuardSchema.extend({
  target: z.enum(["PROFILE", "VIDEO", "BOTH"]),
  profileReason: z.string().trim().min(3).max(2000).optional(),
  videoReason: z.string().trim().min(3).max(2000).optional(),
}).strict().superRefine((value, context) => {
  if ((value.target === "PROFILE" || value.target === "BOTH") && !value.profileReason) {
    context.addIssue({ code: "custom", path: ["profileReason"], message: "A profile reason is required." });
  }
  if ((value.target === "VIDEO" || value.target === "BOTH") && !value.videoReason) {
    context.addIssue({ code: "custom", path: ["videoReason"], message: "A video reason is required." });
  }
});

export const teacherModerationSchema = z.object({
  reviewCycle: z.number().int().nonnegative(),
  reason: z.string().trim().min(3).max(2000),
}).strict();
