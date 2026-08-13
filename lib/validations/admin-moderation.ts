import { z } from "zod";

export const adminModerationListQuerySchema = z
  .object({
    status: z.enum(["APPROVED", "SUSPENDED"]),
    cursor: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
