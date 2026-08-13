import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
  requireAdminPageAccess: vi.fn(),
  getAdminTeacherApplication: vi.fn(),
  notFound: vi.fn(),
  fromTimezoneEnum: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/lib/auth/admin-page-guard", () => ({
  requireAdminPageAccess: mocks.requireAdminPageAccess,
}));

vi.mock("@/lib/services/admin-review.service", () => ({
  getAdminTeacherApplication: mocks.getAdminTeacherApplication,
}));

vi.mock("@/lib/timezone", () => ({
  fromTimezoneEnum: mocks.fromTimezoneEnum,
}));

vi.mock("@/components/admin/AdminReviewDetail", () => ({
  AdminReviewDetail: () => null,
}));

import AdminTeacherApplicationDetailPage from "@/app/[locale]/admin/teacher-applications/[applicationId]/page";
import { AdminTargetNotFoundError } from "@/lib/errors/admin-errors";

const validApplicationId = "ck12345678901234567890123";

const detail = {
  id: validApplicationId,
  userId: "ck32345678901234567890123",
  headline: "Speaking coach for intermediate learners",
  bio: "Professional biography",
  experienceYears: 6,
  nativeLanguage: "fa",
  teachingLanguage: "en",
  timezone: "Asia_Tehran",
  profileCompletedAt: new Date("2026-08-10T10:00:00.000Z"),
  profileRevision: 3,
  applicationStatus: "PENDING_REVIEW",
  applicationSubmittedAt: new Date("2026-08-13T10:00:00.000Z"),
  applicationReviewedAt: null,
  applicationReviewNote: null,
  reviewCycle: 2,
  submittedProfileRevision: 3,
  submittedVideoId: "ck22345678901234567890123",
  submittedVideoRevision: 4,
  submittedVideoUploadId: "upload-id",
  submittedVideoAssetId: "asset-id",
  createdAt: new Date("2026-08-01T10:00:00.000Z"),
  updatedAt: new Date("2026-08-13T10:00:00.000Z"),
  user: {
    id: "ck32345678901234567890123",
    name: "Teacher Applicant",
    email: "teacher@example.com",
    accountStatus: "ACTIVE",
  },
  introVideo: {
    id: "ck22345678901234567890123",
    provider: "mux",
    uploadId: "upload-id",
    assetId: "asset-id",
    publicPlaybackId: null,
    revision: 4,
    status: "READY_FOR_REVIEW",
    durationSeconds: 90,
    rejectionReason: null,
    submittedAt: new Date("2026-08-13T09:50:00.000Z"),
    reviewedAt: null,
    createdAt: new Date("2026-08-13T09:00:00.000Z"),
    updatedAt: new Date("2026-08-13T09:50:00.000Z"),
    playbackReconciliations: [],
  },
};

describe("admin teacher application detail page", () => {
  beforeEach(() => {
    mocks.getTranslations.mockReset();
    mocks.setRequestLocale.mockReset();
    mocks.requireAdminPageAccess.mockReset();
    mocks.getAdminTeacherApplication.mockReset();
    mocks.notFound.mockReset();
    mocks.fromTimezoneEnum.mockReset();

    mocks.getTranslations.mockResolvedValue((key: string) => key);
    mocks.requireAdminPageAccess.mockResolvedValue({
      session: {
        user: {
          id: "admin-user",
          name: "Admin User",
        },
      },
      admin: {
        permission: "REVIEWER",
      },
    });
    mocks.getAdminTeacherApplication.mockResolvedValue(detail);
    mocks.fromTimezoneEnum.mockReturnValue("Asia/Tehran");
    mocks.notFound.mockImplementation(() => {
      throw new Error("NOT_FOUND");
    });
  });

  it("authorizes server-side, validates the ID, and loads detail through the existing service", async () => {
    const result = (await AdminTeacherApplicationDetailPage({
      params: Promise.resolve({
        locale: "en",
        applicationId: validApplicationId,
      }),
    })) as ReactElement<{
      application: {
        snapshotAligned: boolean;
        timezoneLabel: string;
        user: Record<string, unknown>;
        introVideo: Record<string, unknown>;
      };
    }>;

    expect(mocks.setRequestLocale).toHaveBeenCalledWith("en");
    expect(mocks.requireAdminPageAccess).toHaveBeenCalledWith("en");
    expect(mocks.getAdminTeacherApplication).toHaveBeenCalledWith(
      "admin-user",
      validApplicationId,
    );
    expect(mocks.getTranslations).toHaveBeenCalledWith({
      locale: "en",
      namespace: "AdminReviewDetail",
    });
    expect(result.props.application.snapshotAligned).toBe(true);
    expect(result.props.application.timezoneLabel).toBe("Asia/Tehran");
    expect(result.props.application).not.toHaveProperty("submittedVideoUploadId");
    expect(result.props.application.user).not.toHaveProperty("id");
    expect(result.props.application.introVideo).not.toHaveProperty("id");
    expect(result.props.application.introVideo).not.toHaveProperty("assetId");
    expect(result.props.application.introVideo).not.toHaveProperty("uploadId");
    expect(result.props.application.introVideo).not.toHaveProperty("publicPlaybackId");
  });

  it("detects hidden provider identity drift without exposing provider identifiers", async () => {
    mocks.getAdminTeacherApplication.mockResolvedValue({
      ...detail,
      introVideo: {
        ...detail.introVideo,
        assetId: "different-asset-id",
      },
    });

    const result = (await AdminTeacherApplicationDetailPage({
      params: Promise.resolve({
        locale: "en",
        applicationId: validApplicationId,
      }),
    })) as ReactElement<{
      application: {
        snapshotAligned: boolean;
        introVideo: Record<string, unknown>;
      };
    }>;

    expect(result.props.application.snapshotAligned).toBe(false);
    expect(result.props.application.introVideo).not.toHaveProperty("assetId");
  });

  it("authorizes before rejecting a malformed application ID", async () => {
    await expect(
      AdminTeacherApplicationDetailPage({
        params: Promise.resolve({
          locale: "fa",
          applicationId: "not-a-cuid",
        }),
      }),
    ).rejects.toThrow("NOT_FOUND");

    expect(mocks.requireAdminPageAccess).toHaveBeenCalledWith("fa");
    expect(mocks.getAdminTeacherApplication).not.toHaveBeenCalled();
  });

  it("maps a missing authorized target to the page not-found boundary", async () => {
    mocks.getAdminTeacherApplication.mockRejectedValue(
      new AdminTargetNotFoundError(),
    );

    await expect(
      AdminTeacherApplicationDetailPage({
        params: Promise.resolve({
          locale: "en",
          applicationId: validApplicationId,
        }),
      }),
    ).rejects.toThrow("NOT_FOUND");

    expect(mocks.requireAdminPageAccess).toHaveBeenCalledWith("en");
    expect(mocks.getAdminTeacherApplication).toHaveBeenCalledWith(
      "admin-user",
      validApplicationId,
    );
  });
});
