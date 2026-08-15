import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/server", () => ({
  serverEnv: {
    BETTER_AUTH_URL: "https://app.takineo.test",
  },
}));

import { hasTrustedRequestOrigin } from "@/lib/security/same-origin";

function request(origin?: string) {
  const headers = new Headers();
  if (origin !== undefined) headers.set("origin", origin);
  return new Request("https://app.takineo.test/api/admin/example", {
    method: "POST",
    headers,
  });
}

describe("administrative trusted-origin boundary", () => {
  it("accepts only the exact configured application origin", () => {
    expect(hasTrustedRequestOrigin(request("https://app.takineo.test"))).toBe(
      true,
    );
  });

  it.each([
    undefined,
    "http://app.takineo.test",
    "https://app.takineo.test:444",
    "https://app.takineo.test.evil.example",
    "https://evil.example",
  ])("rejects adversarial origin %s", (origin) => {
    expect(hasTrustedRequestOrigin(request(origin))).toBe(false);
  });
});
