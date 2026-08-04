import { z } from "zod";

import { USER_ROLES } from "@/lib/domain/user-role";

export const onboardingSchema = z.object({
  role: z.enum(USER_ROLES),
});

export type OnboardingInput = z.infer<
  typeof onboardingSchema
>;