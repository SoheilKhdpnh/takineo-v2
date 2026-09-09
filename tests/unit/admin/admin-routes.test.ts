import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiSession: vi.fn(),
  requireAdminAccess: vi.fn(),
  getCurrentAdminCapabilities: vi.fn(),
  listPendingTeacherApplications: vi.fn(),
  getAdminTeacherApplication: vi.fn(),
  createAdminReviewPlayback: vi.fn(),
  approveTeacherApplication: vi.fn(),
  rejectTeacherApplication: vi.fn(),
  setTeacherSuspension: vi.fn(),
  hasTrustedRequestOrigin: vi.fn(),
}));

vi.mock("@/lib/auth/api-session", () => ({
  getApiSession: mocks.getApiSession,
}));

vi.mock("@/lib/auth/admin-access", () => ({
  requireAdminAccess: mocks.requireAdminAccess,
  getCurrentAdminCapabilities:
    mocks.getCurrentAdminCapabilities,
}));

vi.mock("@/lib/services/admin-review.service", () => ({
  listPendingTeacherApplications:
    mocks.listPendingTeacherApplications,
  getAdminTeacherApplication:
    mocks.getAdminTeacherApplication,
  createAdminReviewPlayback:
    mocks.createAdminReviewPlayback,
  approveTeacherApplication:
    mocks.approveTeacherApplication,
  rejectTeacherApplication:
    mocks.rejectTeacherApplication,
  setTeacherSuspension:
    mocks.setTeacherSuspension,
}));

vi.mock("@/lib/security/same-origin", () => ({
  hasTrustedRequestOrigin:
    mocks.hasTrustedRequestOrigin,
}));

import {
  GET as getTeacherApplication,
} from "@/app/api/admin/teacher-applications/[applicationId]/route";
import {
  POST as approveTeacherApplicationRoute,
} from "@/app/api/admin/teacher-applications/[applicationId]/approve/route";
import {
  POST as moderateTeacherApplication,
} from "@/app/api/admin/teacher-applications/[applicationId]/moderation/route";
import {
  POST as createPlayback,
} from "@/app/api/admin/teacher-applications/[applicationId]/playback/route";
import {
  POST as rejectTeacherApplicationRoute,
} from "@/app/api/admin/teacher-applications/[applicationId]/reject/route";
import {
  GET as listTeacherApplications,
} from "@/app/api/admin/teacher-applications/route";
import {
  dynamic as adminSessionDynamic,
  GET as getAdminSession,
} from "@/app/api/admin/session/route";
import {
  AdminForbiddenError,
  AdminReviewConflictError,
} from "@/lib/errors/admin-errors";

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
    mocks.getCurrentAdminCapabilities.mockReset();
    mocks.listPendingTeacherApplications.mockReset();
    mocks.getAdminTeacherApplication.mockReset();
    mocks.createAdminReviewPlayback.mockReset();
    mocks.approveTeacherApplication.mockReset();
    mocks.rejectTeacherApplication.mockReset();
    mocks.setTeacherSuspension.mockReset();
    mocks.hasTrustedRequestOrigin.mockReset();

    mocks.getApiSession.mockResolvedValue(session());
    mocks.requireAdminAccess.mockResolvedValue({
      permission: "REVIEWER",
    });

    mocks.getCurrentAdminCapabilities.mockResolvedValue({
      userId: "admin-user",
      permission: "REVIEWER",
      capabilities: {
        reviewTeacherApplications: true,
        moderateTeachers: false,
        moderateAccounts: false,
        manageAdminAccess: false,
        manageSessions: false,
      },
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

    mocks.approveTeacherApplication.mockResolvedValue({
      id: validApplicationId,
      applicationStatus: "APPROVED",
    });

    mocks.rejectTeacherApplication.mockResolvedValue({
      id: validApplicationId,
      applicationStatus: "REJECTED",
    });

    mocks.setTeacherSuspension.mockResolvedValue({
      id: validApplicationId,
      applicationStatus: "SUSPENDED",
    });
  });

  describe("admin capability session GET", () => {
    it("is explicitly dynamic", () => {
      expect(
        adminSessionDynamic,
      ).toBe(
        "force-dynamic",
      );
    });

    it("returns a private 401 without consulting capabilities when unauthenticated", async () => {
      mocks.getApiSession.mockResolvedValue(null);

      const response = await getAdminSession(
        new Request(
          "http://localhost:3000/api/admin/session",
        ),
      );

      expect(response.status).toBe(401);

      await expect(response.json()).resolves.toEqual({
        error: "UNAUTHORIZED",
      });

      expect(response.headers.get("cache-control")).toBe(
        "private, no-store",
      );

      expect(
        mocks.getCurrentAdminCapabilities,
      ).not.toHaveBeenCalled();
    });

    it("returns the server-derived reviewer capabilities without public caching", async () => {
      const response = await getAdminSession(
        new Request(
          "http://localhost:3000/api/admin/session",
        ),
      );

      expect(response.status).toBe(200);

      await expect(response.json()).resolves.toEqual({
        admin: {
          userId: "admin-user",
          permission: "REVIEWER",
          capabilities: {
            reviewTeacherApplications: true,
            moderateTeachers: false,
            moderateAccounts: false,
            manageAdminAccess: false,
            manageSessions: false,
          },
        },
      });

      expect(
        mocks.getCurrentAdminCapabilities,
      ).toHaveBeenCalledWith(
        "admin-user",
      );

      expect(response.headers.get("cache-control")).toBe(
        "private, no-store",
      );
    });

    it("returns a private stable 403 when administrative access was revoked", async () => {
      mocks.getCurrentAdminCapabilities.mockRejectedValue(
        new AdminForbiddenError(),
      );

      const response = await getAdminSession(
        new Request(
          "http://localhost:3000/api/admin/session",
        ),
      );

      expect(response.status).toBe(403);

      await expect(response.json()).resolves.toEqual({
        error: "ADMIN_FORBIDDEN",
      });

      expect(response.headers.get("cache-control")).toBe(
        "private, no-store",
      );
    });

    it("fails closed without leaking an unexpected capability error", async () => {
      vi.spyOn(
        console,
        "error",
      ).mockImplementation(() => undefined);

      mocks.getCurrentAdminCapabilities.mockRejectedValue(
        new Error(
          "database credentials were rejected",
        ),
      );

      const response = await getAdminSession(
        new Request(
          "http://localhost:3000/api/admin/session",
        ),
      );

      expect(response.status).toBe(500);

      await expect(response.json()).resolves.toEqual({
        error: "INTERNAL_SERVER_ERROR",
      });

      expect(response.headers.get("cache-control")).toBe(
        "private, no-store",
      );
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

  describe("review decision POST routes", () => {
    const guard = {
      reviewCycle: 2,
      profileRevision: 3,
      videoId: "cjld2cjxh0001qzrmn831i7rn",
      videoRevision: 4,
    };

    function decisionRequest(
      path: "approve" | "reject",
      body: Record<string, unknown>,
    ) {
      return new Request(
        `http://localhost:3000/api/admin/teacher-applications/${validApplicationId}/${path}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
    }

    it("maps an approval review-state conflict to a private stable 409", async () => {
      mocks.approveTeacherApplication.mockRejectedValue(
        new AdminReviewConflictError(),
      );

      const response = await approveTeacherApplicationRoute(
        decisionRequest("approve", guard),
        context(),
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: "REVIEW_STATE_CONFLICT",
      });
      expect(response.headers.get("cache-control")).toBe(
        "private, no-store",
      );
    });

    it("maps a rejection review-state conflict to a private stable 409", async () => {
      mocks.rejectTeacherApplication.mockRejectedValue(
        new AdminReviewConflictError(),
      );

      const response = await rejectTeacherApplicationRoute(
        decisionRequest("reject", {
          ...guard,
          target: "PROFILE",
          profileReason: "Profile reason for route acceptance.",
        }),
        context(),
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: "REVIEW_STATE_CONFLICT",
      });
      expect(response.headers.get("cache-control")).toBe(
        "private, no-store",
      );
    });

    it("rejects an untrusted approval origin before body validation or service access", async () => {
      mocks.hasTrustedRequestOrigin.mockReturnValue(false);

      const response = await approveTeacherApplicationRoute(
        decisionRequest("approve", { invalid: true }),
        context(),
      );

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: "UNTRUSTED_ORIGIN",
      });
      expect(mocks.approveTeacherApplication).not.toHaveBeenCalled();
    });

    it("dispatches a targeted rejection only after authentication, authorization, origin, and validation", async () => {
      const body = {
        ...guard,
        target: "VIDEO",
        videoReason: "The submitted audio is not reviewable.",
      };

      const response = await rejectTeacherApplicationRoute(
        decisionRequest("reject", body),
        context(),
      );

      expect(response.status).toBe(200);
      expect(mocks.requireAdminAccess).toHaveBeenCalledWith("admin-user");
      expect(mocks.hasTrustedRequestOrigin).toHaveBeenCalledTimes(1);
      expect(mocks.rejectTeacherApplication).toHaveBeenCalledWith(
        "admin-user",
        validApplicationId,
        body,
      );
    });
  });

  describe("teacher moderation POST", () => {
    function moderationRequest() {
      return new Request(
        `http://localhost:3000/api/admin/teacher-applications/${validApplicationId}/moderation`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: "SUSPEND",
            reviewCycle: 1,
            reason: "Confirmed policy violation.",
          }),
        },
      );
    }

    it("returns 401 before moderation authorization without an active session", async () => {
      mocks.getApiSession.mockResolvedValue(null);

      const response = await moderateTeacherApplication(
        moderationRequest(),
        context(),
      );

      expect(response.status).toBe(401);

      expect(
        mocks.requireAdminAccess,
      ).not.toHaveBeenCalled();

      expect(
        mocks.hasTrustedRequestOrigin,
      ).not.toHaveBeenCalled();

      expect(
        mocks.setTeacherSuspension,
      ).not.toHaveBeenCalled();
    });

    it("denies a REVIEWER before origin, validation, or target lookup", async () => {
      mocks.requireAdminAccess.mockRejectedValue(
        new AdminForbiddenError(),
      );

      const response = await moderateTeacherApplication(
        moderationRequest(),
        context(),
      );

      expect(response.status).toBe(403);

      await expect(response.json()).resolves.toEqual({
        error: "ADMIN_FORBIDDEN",
      });

      expect(
        mocks.requireAdminAccess,
      ).toHaveBeenCalledWith(
        "admin-user",
        "MODERATE_TEACHER",
      );

      expect(
        mocks.hasTrustedRequestOrigin,
      ).not.toHaveBeenCalled();

      expect(
        mocks.setTeacherSuspension,
      ).not.toHaveBeenCalled();
    });

    it("dispatches valid moderation only after SUPER_ADMIN authorization", async () => {
      mocks.requireAdminAccess.mockResolvedValue({
        userId: "admin-user",
        permission: "SUPER_ADMIN",
      });

      const response = await moderateTeacherApplication(
        moderationRequest(),
        context(),
      );

      expect(response.status).toBe(200);

      expect(
        mocks.requireAdminAccess,
      ).toHaveBeenCalledWith(
        "admin-user",
        "MODERATE_TEACHER",
      );

      expect(
        mocks.setTeacherSuspension,
      ).toHaveBeenCalledWith(
        "admin-user",
        validApplicationId,
        true,
        {
          action: "SUSPEND",
          reviewCycle: 1,
          reason: "Confirmed policy violation.",
        },
      );

      expect(response.headers.get("cache-control")).toBe(
        "private, no-store",
      );
    });
  });
});
