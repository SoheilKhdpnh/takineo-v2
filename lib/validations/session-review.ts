import { z } from "zod";

import {
  SESSION_REVIEW_MAX_COMMENT_LENGTH,
  SESSION_REVIEW_MAX_RATING,
  SESSION_REVIEW_MIN_RATING,
} from "@/lib/domain/session-review-policy";
import {
  liveSessionReadIdSchema,
} from "@/lib/validations/live-session";

export const submitSessionReviewSchema = z
  .object({
    sessionId: liveSessionReadIdSchema,
    rating: z
      .number()
      .int()
      .min(SESSION_REVIEW_MIN_RATING)
      .max(SESSION_REVIEW_MAX_RATING),
    comment: z
      .string()
      .max(SESSION_REVIEW_MAX_COMMENT_LENGTH)
      .optional(),
  })
  .strict();

export const submitSessionReviewBodySchema = submitSessionReviewSchema
  .omit({
    sessionId: true,
  })
  .strict();

export type SubmitSessionReviewInput = z.infer<
  typeof submitSessionReviewSchema
>;
