import { z } from "zod";

import {
  isAllowedUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/domain/username";

export const usernameAvailabilityQuerySchema = z.object({
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN_LENGTH)
    .max(USERNAME_MAX_LENGTH)
    .refine(isAllowedUsername, {
      message: "INVALID_USERNAME",
    }),
});
