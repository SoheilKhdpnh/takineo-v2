import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiSession: vi.fn(),
  requireAdminAccess: vi.fn(),
  listPendingTeacherApplications: vi.fn(),
  getAdminTeacherApplication: vi.fn(),
  createAdminReviewPlayback: vi.fn(),
  hasTrustedRequestOrigin: vi.fn(),
}));

vi.mock("@/lib/auth/api-session", () => ({
  getApiSession: mocks.getApiSession,
}));

vi.mock("@/lib/auth/admin-access", () => ({
  requireAdminAccess: mocks.requireAdminAccess,
}));

vi.mock("@/lib/services/admin-review.service", () => ({
  listPendingTeacherApplications:
    mocks.listPendingTeacherApplications,
  getAdminTeacherApplication:
    mocks.getAdminTeacherApplication,
  createAdminReviewPlayback:
    mocks.createAdminReviewPlayback,
}));

vi.mock("@/lib/security/same-origin", () => ({
  hasTrustedRequestOrigin:
    mocks.hasTrustedRequestOrigin,
}));

import {
  GET as getTeacherApplication,
} from "@/app/api/admin/teacher-applications/[applicationId]/route";
import {
  POST as createPlayback,
} from "@/app/api/admin/teacher-applications/[applicationId]/playback/route";
import {
  GET as listTeacherApplications,
} from "@/app/api/admin/teacher-applications/route";
import { AdminForbiddenError } from "@/lib/errors/admin-errors";

const validApplicationId = "cjld2cjxh0000qzrmn831i7rn";

function session(userId = "admin-user") {
  return {
    user: {
      id: userId,
    },
  };
}

function context(applicationId = validApplicationId) {
  return {
    params: Promise.resolve({
      applicationId,
    }),
  };
}

describe("admin teacher application routes", () => {
  beforeEach(() => {
    mocks.getApiSession.mockReset();
    mocks.requireAdminAccess.mockReset();
    mocks.listPendingTeacherApplications.mockReset();
    mocks.getAdminTeacherApplication.mockReset();
    mocks.createAdminReviewPlayback.mockReset();
    mocks.hasTrustedRequestOrigin.mockReset();

    mocks.getApiSession.mockResolvedValue(session());
    mocks.requireAdminAccess.mockResolvedValue({
      permission: "REVIEWER",
    });

    mocks.hasTrustedRequestOrigin.mockReturnValue(true);

    mocks.listPendingTeacherApplications.mockResolvedValue({
      applications: [],
      nextCursor: null,
    });

    mocks.getAdminTeacherApplication.mockResolvedValue({
      id: validApplicationId,
    });

    mocks.createAdminReviewPlayback.mockResolvedValue({
      playbackId: "playback-id",
      token: "signed-token",
      expiresInSeconds: 300,
    });
  });

  describe("pending queue GET", () => {
    it("returns 401 before admin authorization when there is no active session", async () => {
      mocks.getApiSession.mockResolvedValue(null);

      const response = await listTeacherApplications(
        new Request(
          "http://localhost:3000/api/admin/teacher-applications?limit=0",
        ),
      );

      expect(response.status).toBe(401);

      await expect(response.json()).resolves.toEqual({
        error: "UNAUTHORIZED",
      });

      expect(mocks.requireAdminAccess).not.toHaveBeenCalled();
      expect(
        mocks.listPendingTeacherApplications,
      ).not.toHaveBeenCalled();
    });

    it("returns 403 before query validation for a non-admin", async () => {
      mocks.requireAdminAccess.mockRejectedValue(
        new AdminForbiddenError(),
      );

      const response = await listTeacherApplications(
        new Request(
          "http://localhost:3000/api/admin/teacher-applications?limit=0",
        ),
      );

      expect(response.status).toBe(403);

      await expect(response.json()).resolves.toEqual({
        error: "ADMIN_FORBIDDEN",
      });

      expect(
        mocks.listPendingTeacherApplications,
      ).not.toHaveBeenCalled();
    });

    it("returns 400 for malformed query only after admin authorization", async () => {
      const response = await listTeacherApplications(
        new Request(
          "http://localhost:3000/api/admin/teacher-applications?limit=0",
        ),
      );

      expect(response.status).toBe(400);
      expect(mocks.requireAdminAccess).toHaveBeenCalledWith(
        "admin-user",
      );

      expect(
        mocks.listPendingTeacherApplications,
      ).not.toHaveBeenCalled();
    });

    it("calls the queue service for an authorized valid request", async () => {
      const response = await listTeacherApplications(
        new Request(
          "http://localhost:3000/api/admin/teacher-applications?limit=10",
        ),
      );

      expect(response.status).toBe(200);

      expect(
        mocks.listPendingTeacherApplications,
      ).toHaveBeenCalledWith(
        "admin-user",
        expect.objectContaining({
          limit: 10,
        }),
      );

      expect(response.headers.get("cache-control")).toBe(
        "private, no-store",
      );
    });
  });

  describe("application detail GET", () => {
    it("returns 403 before application ID validation for a non-admin", async () => {
      mocks.requireAdminAccess.mockRejectedValue(
        new AdminForbiddenError(),
      );

      const response = await getTeacherApplication(
        new Request(
          "http://localhost:3000/api/admin/teacher-applications/not-a-cuid",
        ),
        context("not-a-cuid"),
      );

      expect(response.status).toBe(403);

      expect(
        mocks.getAdminTeacherApplication,
      ).not.toHaveBeenCalled();
    });

    it("returns 400 for malformed application ID after admin authorization", async () => {
      const response = await getTeacherApplication(
        new Request(
          "http://localhost:3000/api/admin/teacher-applications/not-a-cuid",
        ),
        context("not-a-cuid"),
      );

      expect(response.status).toBe(400);

      expect(mocks.requireAdminAccess).toHaveBeenCalledWith(
        "admin-user",
      );

      expect(
        mocks.getAdminTeacherApplication,
      ).not.toHaveBeenCalled();
    });

    it("calls the detail service for an authorized valid request", async () => {
      const response = await getTeacherApplication(
        new Request(
          `http://localhost:3000/api/admin/teacher-applications/${validApplicationId}`,
        ),
        context(),
      );

      expect(response.status).toBe(200);

      expect(
        mocks.getAdminTeacherApplication,
      ).toHaveBeenCalledWith(
        "admin-user",
        validApplicationId,
      );
    });
  });

  describe("review playback POST", () => {
    it("rejects an untrusted origin before request validation", async () => {
      mocks.hasTrustedRequestOrigin.mockReturnValue(false);

      const response = await createPlayback(
        new Request(
          `http://localhost:3000/api/admin/teacher-applications/${validApplicationId}/playback`,
          {
            method: "POST",
            body: "{}",
          },
        ),
        context(),
      );

      expect(response.status).toBe(403);

      await expect(response.json()).resolves.toEqual({
        error: "UNTRUSTED_ORIGIN",
      });

      expect(
        mocks.createAdminReviewPlayback,
      ).not.toHaveBeenCalled();
    });

    it.each([
      ["{}", "{}"],
      ["JSON null", "null"],
      ["whitespace", "   "],
      ["arbitrary content", "anything"],
    ])(
      "rejects non-empty playback body: %s",
      async (_label, body) => {
        const response = await createPlayback(
          new Request(
            `http://localhost:3000/api/admin/teacher-applications/${validApplicationId}/playback`,
            {
              method: "POST",
              body,
            },
          ),
          context(),
        );

        expect(response.status).toBe(400);

        await expect(response.json()).resolves.toEqual({
          error: "INVALID_REQUEST",
          issues: {
            body: ["Request body must be empty."],
          },
        });

        expect(
          mocks.createAdminReviewPlayback,
        ).not.toHaveBeenCalled();
      },
    );

    it("accepts an absent request body", async () => {
      const response = await createPlayback(
        new Request(
          `http://localhost:3000/api/admin/teacher-applications/${validApplicationId}/playback`,
          {
            method: "POST",
          },
        ),
        context(),
      );

      expect(response.status).toBe(200);

      expect(
        mocks.createAdminReviewPlayback,
      ).toHaveBeenCalledWith(
        "admin-user",
        validApplicationId,
      );
    });

    it("preserves revoked-admin authorization as 403 instead of converting it to 502", async () => {
      mocks.createAdminReviewPlayback.mockRejectedValue(
        new AdminForbiddenError(),
      );

      const response = await createPlayback(
        new Request(
          `http://localhost:3000/api/admin/teacher-applications/${validApplicationId}/playback`,
          {
            method: "POST",
          },
        ),
        context(),
      );

      expect(response.status).toBe(403);

      await expect(response.json()).resolves.toEqual({
        error: "ADMIN_FORBIDDEN",
      });

      expect(response.status).not.toBe(502);
    });
  });
});
