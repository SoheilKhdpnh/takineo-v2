import { describe, expect, it } from "vitest";

import {
  extensionEndAt,
  parseSessionExtensionDecision,
} from "@/components/live-session/session-extension-model";

describe("session extension", () => {
  const bookedEnd = "2026-10-05T16:15:00.000Z";

  it("adds five or ten minutes after the booked end", () => {
    expect(extensionEndAt(bookedEnd, 5)).toBe("2026-10-05T16:20:00.000Z");
    expect(extensionEndAt(bookedEnd, 10)).toBe("2026-10-05T16:25:00.000Z");
  });

  it("accepts only the teacher's three choices", () => {
    expect(parseSessionExtensionDecision('{"decision":5}')).toBe(5);
    expect(parseSessionExtensionDecision('{"decision":10}')).toBe(10);
    expect(parseSessionExtensionDecision('{"decision":"end"}')).toBe("end");
    expect(parseSessionExtensionDecision('{"decision":15}')).toBeNull();
    expect(parseSessionExtensionDecision("not-json")).toBeNull();
  });
});
