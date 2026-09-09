import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAccountStatusForAuth: vi.fn(),
  isInactiveAccountSelfServicePath: vi.fn(),
  getHandler: vi.fn(),
  postHandler: vi.fn(),
}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: vi.fn(() => ({
    GET: mocks.getHandler,
    POST: mocks.postHandler,
  })),
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}));

vi.mock("@/lib/auth/account-policy", () => ({
  getAccountStatusForAuth: mocks.getAccountStatusForAuth,
  isInactiveAccountSelfServicePath:
    mocks.isInactiveAccountSelfServicePath,
}));

import {
  GET,
  POST,
} from "@/app/api/auth/[...all]/route";

function request(path: string, method = "GET") {
  return new Request(`http://localhost:3000${path}`, {
    method,
  });
}

describe("Better Auth inactive-account route policy", () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.getAccountStatusForAuth.mockReset();
    mocks.isInactiveAccountSelfServicePath.mockReset();
    mocks.getHandler.mockReset();
    mocks.postHandler.mockReset();

    mocks.getHandler.mockResolvedValue(
      Response.json({ delegated: true }),
    );

    mocks.postHandler.mockResolvedValue(
      Response.json({ delegated: true }),
    );

    mocks.isInactiveAccountSelfServicePath.mockReturnValue(false);
  });

  it("blocks inactive /get-session before the Better Auth handler", async () => {
    mocks.getSession.mockResolvedValue({
      user: {
        id: "inactive-user",
      },
    });

    mocks.getAccountStatusForAuth.mockResolvedValue("SUSPENDED");
    mocks.isInactiveAccountSelfServicePath.mockReturnValue(false);

    const response = await GET(
      request("/api/auth/get-session"),
    );

    expect(response.status).toBe(403);

    await expect(response.json()).resolves.toEqual({
      error: "ACCOUNT_INACTIVE",
    });

    expect(response.headers.get("cache-control")).toBe(
      "private, no-store",
    );

    expect(mocks.getHandler).not.toHaveBeenCalled();

    expect(mocks.getSession).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          disableCookieCache: true,
          disableRefresh: true,
        },
      }),
    );
  });

  it("allows inactive session-listing self-service", async () => {
    mocks.getSession.mockResolvedValue({
      user: {
        id: "inactive-user",
      },
    });

    mocks.getAccountStatusForAuth.mockResolvedValue("DISABLED");
    mocks.isInactiveAccountSelfServicePath.mockReturnValue(true);

    const req = request("/api/auth/list-sessions");

    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(mocks.getHandler).toHaveBeenCalledWith(req);
  });

  it("allows sign-out without account-policy preflight", async () => {
    const req = request("/api/auth/sign-out", "POST");

    const response = await POST(req);

    expect(response.status).toBe(200);

    expect(mocks.postHandler).toHaveBeenCalledWith(req);

    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.getAccountStatusForAuth).not.toHaveBeenCalled();
  });

  it("allows ACTIVE users to continue to Better Auth", async () => {
    mocks.getSession.mockResolvedValue({
      user: {
        id: "active-user",
      },
    });

    mocks.getAccountStatusForAuth.mockResolvedValue("ACTIVE");

    const req = request("/api/auth/change-password", "POST");

    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(mocks.postHandler).toHaveBeenCalledWith(req);
  });

  it("blocks ordinary Better Auth operations for inactive users", async () => {
    mocks.getSession.mockResolvedValue({
      user: {
        id: "inactive-user",
      },
    });

    mocks.getAccountStatusForAuth.mockResolvedValue("SUSPENDED");
    mocks.isInactiveAccountSelfServicePath.mockReturnValue(false);

    const response = await POST(
      request("/api/auth/change-password", "POST"),
    );

    expect(response.status).toBe(403);
    expect(mocks.postHandler).not.toHaveBeenCalled();
  });

  it("allows unauthenticated requests to reach Better Auth", async () => {
    mocks.getSession.mockResolvedValue(null);

    const req = request("/api/auth/sign-in/email", "POST");

    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(mocks.postHandler).toHaveBeenCalledWith(req);

    expect(
      mocks.getAccountStatusForAuth,
    ).not.toHaveBeenCalled();
  });
});
