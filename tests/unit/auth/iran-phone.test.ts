import { describe, expect, it } from "vitest";

import {
  iranPhoneToInternalEmail,
  isIranE164,
  isIranMobileNationalNumber,
  toIranE164,
  toIranE164FromInput,
  toKavenegarReceptor,
} from "@/lib/domain/iran-phone";

describe("Iran mobile numbers", () => {
  it("accepts a 10-digit number starting with 9 and without a leading 0", () => {
    expect(isIranMobileNationalNumber("9142928321")).toBe(true);
    expect(toIranE164("9142928321")).toBe("+989142928321");
    expect(iranPhoneToInternalEmail("+989142928321")).toBe(
      "989142928321@phone.talkinu.invalid",
    );
  });

  it.each(["09142928321", "8142928321", "914292832", "91429283211", "+989142928321"])(
    "rejects %s as a national number",
    (value) => {
      expect(isIranMobileNationalNumber(value)).toBe(false);
    },
  );

  it("converts Iranian numbers to E.164 and Kavenegar receptor form", () => {
    expect(toIranE164FromInput("9142928321")).toBe("+989142928321");
    expect(toIranE164FromInput("+989142928321")).toBe("+989142928321");
    expect(toKavenegarReceptor("+989142928321")).toBe("989142928321");
    expect(isIranE164("+989142928321")).toBe(true);
    expect(isIranE164("9142928321")).toBe(false);
  });
});
