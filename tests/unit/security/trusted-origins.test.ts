import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/server", () => ({
  serverEnv: {
    BETTER_AUTH_URL: "https://app.takineo.test",
  },
}));

import {
  getTrustedApplicationOrigins,
  isTrustedApplicationOrigin,
} from "@/lib/security/trusted-origins";

describe("trusted auth origins", () => {
  it("trusts the configured origin and its www alternate", () => {
    expect(getTrustedApplicationOrigins()).toEqual([
      "https://app.takineo.test",
      "https://www.app.takineo.test",
    ]);
  });

  it("accepts apex and www of the configured origin", () => {
    expect(isTrustedApplicationOrigin("https://app.takineo.test")).toBe(true);
    expect(isTrustedApplicationOrigin("https://www.app.takineo.test/")).toBe(
      true,
    );
  });

  it("rejects missing and foreign origins", () => {
    expect(isTrustedApplicationOrigin(null)).toBe(false);
    expect(isTrustedApplicationOrigin("https://evil.example")).toBe(false);
    expect(isTrustedApplicationOrigin("https://talkinu.com")).toBe(false);
  });
});
