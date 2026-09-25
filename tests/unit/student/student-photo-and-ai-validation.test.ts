import { describe, expect, it } from "vitest";

import { profilePhotoInputSchema } from "@/lib/validations/profile-photo";
import { studentAiChatInputSchema } from "@/lib/validations/student-ai-chat";

describe("profile photo validation", () => {
  it("accepts a compact jpeg data URL", () => {
    const result = profilePhotoInputSchema.safeParse({
      imageDataUrl:
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD",
    });

    expect(result.success).toBe(true);
  });

  it("rejects non-image payloads", () => {
    const result = profilePhotoInputSchema.safeParse({
      imageDataUrl: "data:text/plain;base64,aaaa",
    });

    expect(result.success).toBe(false);
  });
});

describe("student AI chat validation", () => {
  it("accepts a short user message thread", () => {
    const result = studentAiChatInputSchema.safeParse({
      messages: [{ role: "user", content: "How do I practice past tense?" }],
    });

    expect(result.success).toBe(true);
  });

  it("rejects empty message content", () => {
    const result = studentAiChatInputSchema.safeParse({
      messages: [{ role: "user", content: "   " }],
    });

    expect(result.success).toBe(false);
  });
});
