import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

import {
  getKavenegarConfiguration,
  hasKavenegarConfiguration,
  sendKavenegarOtp,
} from "@/lib/providers/kavenegar";
import {
  KavenegarDeliveryError,
  KavenegarNotConfiguredError,
} from "@/lib/errors/sms-errors";

describe("Kavenegar OTP provider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    mocks.fetch.mockReset();
    vi.unstubAllGlobals();
    delete process.env.KAVENEGAR_API_KEY;
    delete process.env.KAVENEGAR_OTP_TEMPLATE;
  });

  it("stays unconfigured until both credentials exist", () => {
    process.env.KAVENEGAR_OTP_TEMPLATE = "talkinu-otp";

    expect(hasKavenegarConfiguration()).toBe(false);
    expect(() => getKavenegarConfiguration()).toThrow(
      KavenegarNotConfiguredError,
    );
  });

  it("sends a lookup OTP without putting the code in logs", async () => {
    process.env.KAVENEGAR_API_KEY = "test-kavenegar-key";
    process.env.KAVENEGAR_OTP_TEMPLATE = "talkinu-otp";
    mocks.fetch.mockResolvedValue({
      json: async () => ({ return: { status: 200 } }),
    });

    await sendKavenegarOtp({
      phoneNumber: "+989142928321",
      code: "123456",
    });

    expect(mocks.fetch).toHaveBeenCalledOnce();
    const [url, init] = mocks.fetch.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toContain("/verify/lookup.json");
    expect(String(init.body)).toContain("receptor=989142928321");
    expect(String(init.body)).toContain("token=123456");
    expect(String(init.body)).toContain("template=talkinu-otp");
  });

  it("fails closed when Kavenegar rejects the request", async () => {
    process.env.KAVENEGAR_API_KEY = "test-kavenegar-key";
    process.env.KAVENEGAR_OTP_TEMPLATE = "talkinu-otp";
    mocks.fetch.mockResolvedValue({
      json: async () => ({ return: { status: 418 } }),
    });

    await expect(
      sendKavenegarOtp({
        phoneNumber: "+989142928321",
        code: "123456",
      }),
    ).rejects.toBeInstanceOf(KavenegarDeliveryError);
  });
});
