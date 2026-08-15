import { describe, expect, it, vi } from "vitest";

import { adminErrorResponse } from "@/lib/errors/admin-http";

describe("administrative unexpected-error redaction", () => {
  it("returns a stable private error without logging the raw exception message", async () => {
    const secret = "postgresql://admin:VERY_PRIVATE_PASSWORD@database.example/takineo";
    const error = Object.assign(new Error(`connection failed: ${secret}`), {
      code: "P1001",
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = adminErrorResponse(error);

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      error: "INTERNAL_SERVER_ERROR",
    });
    expect(errorSpy).toHaveBeenCalledWith("Unexpected admin review error:", {
      errorName: "Error",
      errorCode: "P1001",
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(secret);

    errorSpy.mockRestore();
  });

  it("drops an untrusted error name instead of allowing log injection", () => {
    const injected = "Error\nSECRET_SECOND_LINE";
    const error = new Error("provider failed");
    error.name = injected;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    adminErrorResponse(error);

    expect(errorSpy).toHaveBeenCalledWith("Unexpected admin review error:", {
      errorName: "UnknownError",
      errorCode: null,
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(injected);

    errorSpy.mockRestore();
  });

  it("drops untrusted machine codes instead of reflecting them into logs", async () => {
    const injected = "SECRET\nsecond-log-line";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    adminErrorResponse(Object.assign(new Error("provider failed"), { code: injected }));

    expect(errorSpy).toHaveBeenCalledWith("Unexpected admin review error:", {
      errorName: "Error",
      errorCode: null,
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(injected);

    errorSpy.mockRestore();
  });
});
