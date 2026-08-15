import { describe, expect, it } from "vitest";

import { getBrowserSecurityHeaders } from "@/lib/security/browser-security-headers";

function headerValue(
  headers: ReturnType<typeof getBrowserSecurityHeaders>,
  key: string,
) {
  return headers.find((header) => header.key === key)?.value;
}

describe("browser security headers", () => {
  it("enforces the low-risk baseline on every environment", () => {
    const headers = getBrowserSecurityHeaders(false);

    expect(headerValue(headers, "X-Content-Type-Options")).toBe("nosniff");
    expect(headerValue(headers, "X-Frame-Options")).toBe("DENY");
    expect(headerValue(headers, "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("does not disable camera or microphone ahead of the speaking-session wave", () => {
    const permissionsPolicy = headerValue(
      getBrowserSecurityHeaders(false),
      "Permissions-Policy",
    );

    expect(permissionsPolicy).toContain("geolocation=()");
    expect(permissionsPolicy).not.toContain("camera=()");
    expect(permissionsPolicy).not.toContain("microphone=()");
  });

  it("keeps CSP observational outside production", () => {
    expect(
      headerValue(
        getBrowserSecurityHeaders(false),
        "Content-Security-Policy-Report-Only",
      ),
    ).toBeUndefined();
  });

  it("publishes a Mux-aware report-only CSP in production", () => {
    const csp = headerValue(
      getBrowserSecurityHeaders(true),
      "Content-Security-Policy-Report-Only",
    );

    expect(csp).toContain("frame-src 'self' https://player.mux.com");
    expect(csp).toContain("media-src 'self' blob: https://*.mux.com");
    expect(csp).toContain("https://storage.googleapis.com");
    expect(csp).toContain("https://*.litix.io");
  });

  it("does not bless eval while CSP is being observed", () => {
    const csp = headerValue(
      getBrowserSecurityHeaders(true),
      "Content-Security-Policy-Report-Only",
    );

    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
  });
});
