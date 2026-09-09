import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiSession: vi.fn(),
  requireAdminAccess: vi.fn(),
  listModeratableTeachers: vi.fn(),
}));

vi.mock("@/lib/auth/api-session", () => ({
  getApiSession: mocks.getApiSession,
}));

vi.mock("@/lib/auth/admin-access", () => ({
  requireAdminAccess: mocks.requireAdminAccess,
}));

vi.mock("@/lib/services/admin-moderation.service", () => ({
  listModeratableTeachers: mocks.listModeratableTeachers,
}));

import {
  dynamic,
  GET as listTeachers,
} from "@/app/api/admin/teachers/route";
import { AdminForbiddenError } from "@/lib/errors/admin-errors";

function session(userId = "super-admin-user") {
  return { user: { id: userId } };
}

describe("admin moderation teacher index route", () => {
  beforeEach(() => {
    mocks.getApiSession.mockReset();
    mocks.requireAdminAccess.mockReset();
    mocks.listModeratableTeachers.mockReset();

    mocks.getApiSession.mockResolvedValue(session());
    mocks.requireAdminAccess.mockResolvedValue({
      userId: "super-admin-user",
      permission: "SUPER_ADMIN",
    });
    mocks.listModeratableTeachers.mockResolvedValue({
      teachers: [],
      nextCursor: null,
    });
  });

  it("is explicitly dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns private 401 before moderation authorization when unauthenticated", async () => {
    mocks.getApiSession.mockResolvedValue(null);

    const response = await listTeachers(
      new Request("http://localhost:3000/api/admin/teachers?status=APPROVED"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "UNAUTHORIZED" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.requireAdminAccess).not.toHaveBeenCalled();
    expect(mocks.listModeratableTeachers).not.toHaveBeenCalled();
  });

  it("requires MODERATE_TEACHER before query validation", async () => {
    mocks.requireAdminAccess.mockRejectedValue(new AdminForbiddenError());

    const response = await listTeachers(
      new Request("http://localhost:3000/api/admin/teachers?status=INVALID"),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "ADMIN_FORBIDDEN" });
    expect(mocks.requireAdminAccess).toHaveBeenCalledWith(
      "super-admin-user",
      "MODERATE_TEACHER",
    );
    expect(mocks.listModeratableTeachers).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed moderation query after authorization", async () => {
    const response = await listTeachers(
      new Request("http://localhost:3000/api/admin/teachers?status=APPROVED&limit=0"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_REQUEST",
    });
    expect(mocks.requireAdminAccess).toHaveBeenCalledWith(
      "super-admin-user",
      "MODERATE_TEACHER",
    );
    expect(mocks.listModeratableTeachers).not.toHaveBeenCalled();
  });

  it("requires an explicit APPROVED or SUSPENDED status filter", async () => {
    const response = await listTeachers(
      new Request("http://localhost:3000/api/admin/teachers"),
    );

    expect(response.status).toBe(400);
    expect(mocks.listModeratableTeachers).not.toHaveBeenCalled();
  });

  it("calls the moderation service with validated cursor pagination", async () => {
    const cursor = "cjld2cjxh0000qzrmn831i7rn";

    const response = await listTeachers(
      new Request(
        `http://localhost:3000/api/admin/teachers?status=SUSPENDED&limit=10&cursor=${cursor}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.listModeratableTeachers).toHaveBeenCalledWith(
      "super-admin-user",
      {
        status: "SUSPENDED",
        limit: 10,
        cursor,
      },
    );
  });

  it("maps unexpected service failures without leaking details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.listModeratableTeachers.mockRejectedValue(
      new Error("database credentials were rejected"),
    );

    const response = await listTeachers(
      new Request("http://localhost:3000/api/admin/teachers?status=APPROVED"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "INTERNAL_SERVER_ERROR",
    });
  });
});
