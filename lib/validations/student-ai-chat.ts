import { z } from "zod";

export const studentAiChatInputSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(24),
});

export type StudentAiChatInput = z.infer<typeof studentAiChatInputSchema>;
