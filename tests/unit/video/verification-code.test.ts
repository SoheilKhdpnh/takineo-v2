import { describe, expect, it } from "vitest";

import {
  generateVideoVerificationCode,
  VIDEO_VERIFICATION_CODE_LENGTH,
} from "@/lib/video/verification-code";

describe("generateVideoVerificationCode", () => {
  it("returns a 4–6 character unambiguous code", () => {
    const code = generateVideoVerificationCode();

    expect(code).toHaveLength(VIDEO_VERIFICATION_CODE_LENGTH);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
    expect(VIDEO_VERIFICATION_CODE_LENGTH).toBeGreaterThanOrEqual(4);
    expect(VIDEO_VERIFICATION_CODE_LENGTH).toBeLessThanOrEqual(6);
  });
});
