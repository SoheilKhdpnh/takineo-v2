import "server-only";

import { z } from "zod";

export function getInternalJobSecret() {
  const parsed = z.string().min(32).safeParse(process.env.INTERNAL_JOB_SECRET);
  if (!parsed.success) throw new Error("Internal job authentication is not configured.");
  return parsed.data;
}
