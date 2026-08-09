import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  teacherProfileUpdateMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
    },
    teacherProfile: {
      updateMany: mocks.teacherProfileUpdateMany,
    },
  },
}));

import {
  getTeacherApplicationForUser,
  submitTeacherApplication,
} from "@/lib/services/teacher-application.service";
import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import { TeacherApplicationStateError } from "@/lib/errors/teacher-application-errors";

function makeVideo(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "video-1",
    revision: 3,
    provider: "mux",
    uploadId: "upload-1",
    assetId: "asset-1",
    status: "READY_FOR_REVIEW",
    durationSeconds: 90,
    submittedAt: new Date("2026-08-09T08:00:00.000Z"),
    reviewedAt: null,
    ...overrides,
  };
}

function makeTeacherProfile(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "teacher-profile-1",
    userId: "teacher-user",
    profileCompletedAt: new Date(
      "2026-08-09T07:00:00.000Z",
    ),

    applicationStatus: "DRAFT",
    applicationSubmittedAt: null,
    applicationReviewedAt: null,
    applicationReviewNote: null,

    reviewCycle: 0,
    profileRevision: 4,

    submittedProfileRevision: null,
    submittedVideoId: null,
    submittedVideoRevision: null,
    submittedVideoUploadId: null,
    submittedVideoAssetId: null,

    introVideo: makeVideo(),

    ...overrides,
  };
}

function makeUser(
  profileOverrides: Record<string, unknown> = {},
  userOverrides: Record<string, unknown> = {},
) {
  return {
    accountStatus: "ACTIVE",
    role: "TEACHER",
    teacherProfile: makeTeacherProfile(profileOverrides),
    ...userOverrides,
  };
}

describe("teacher application submission", () => {
  beforeEach(() => {
    mocks.userFindUnique.mockReset();
    mocks.teacherProfileUpdateMany.mockReset();

    mocks.teacherProfileUpdateMany.mockResolvedValue({
      count: 1,
    });
  });

  it("submits a valid DRAFT application", async () => {
    const user = makeUser();

    mocks.userFindUnique.mockResolvedValue(user);

    await submitTeacherApplication("teacher-user");

    expect(
      mocks.teacherProfileUpdateMany,
    ).toHaveBeenCalledTimes(1);

    const update =
      mocks.teacherProfileUpdateMany.mock.calls[0][0];

    expect(update.where).toEqual(
      expect.objectContaining({
        id: "teacher-profile-1",
        applicationStatus: "DRAFT",
        profileRevision: 4,
        user: {
          accountStatus: "ACTIVE",
        },
      }),
    );

    expect(update.where.introVideo).toEqual({
      is: expect.objectContaining({
        id: "video-1",
        revision: 3,
        provider: "mux",
        uploadId: "upload-1",
        assetId: "asset-1",
        status: "READY_FOR_REVIEW",
        durationSeconds: 90,
      }),
    });

    expect(update.data).toEqual(
      expect.objectContaining({
        applicationStatus: "PENDING_REVIEW",
        reviewCycle: {
          increment: 1,
        },
        submittedProfileRevision: 4,
        submittedVideoId: "video-1",
        submittedVideoRevision: 3,
        submittedVideoUploadId: "upload-1",
        submittedVideoAssetId: "asset-1",
      }),
    );

    expect(update.data.applicationSubmittedAt).toBeInstanceOf(
      Date,
    );

    expect(update.data.updatedAt).toBe(
      update.data.applicationSubmittedAt,
    );
  });

  it("allows a REJECTED application to be resubmitted", async () => {
    mocks.userFindUnique.mockResolvedValue(
      makeUser({
        applicationStatus: "REJECTED",
        reviewCycle: 2,
      }),
    );

    await submitTeacherApplication("teacher-user");

    const update =
      mocks.teacherProfileUpdateMany.mock.calls[0][0];

    expect(update.where.applicationStatus).toBe(
      "REJECTED",
    );

    expect(update.data.reviewCycle).toEqual({
      increment: 1,
    });
  });

  it("allows already APPROVED video evidence to be reused for resubmission", async () => {
    mocks.userFindUnique.mockResolvedValue(
      makeUser({
        applicationStatus: "REJECTED",
        introVideo: makeVideo({
          status: "APPROVED",
        }),
      }),
    );

    await expect(
      submitTeacherApplication("teacher-user"),
    ).resolves.toBeDefined();

    expect(
      mocks.teacherProfileUpdateMany,
    ).toHaveBeenCalledTimes(1);
  });

  it.each([
    "PENDING_REVIEW",
    "APPROVED",
    "SUSPENDED",
  ])(
    "rejects submission from application state %s",
    async (applicationStatus) => {
      mocks.userFindUnique.mockResolvedValue(
        makeUser({
          applicationStatus,
        }),
      );

      await expect(
        submitTeacherApplication("teacher-user"),
      ).rejects.toBeInstanceOf(
        TeacherApplicationStateError,
      );

      expect(
        mocks.teacherProfileUpdateMany,
      ).not.toHaveBeenCalled();
    },
  );

  it("rejects an incomplete profile", async () => {
    mocks.userFindUnique.mockResolvedValue(
      makeUser({
        profileCompletedAt: null,
      }),
    );

    await expect(
      submitTeacherApplication("teacher-user"),
    ).rejects.toMatchObject({
      name: "TeacherApplicationNotReadyError",
      reason: "PROFILE_INCOMPLETE",
    });

    expect(
      mocks.teacherProfileUpdateMany,
    ).not.toHaveBeenCalled();
  });

  it("rejects a missing intro video", async () => {
    mocks.userFindUnique.mockResolvedValue(
      makeUser({
        introVideo: null,
      }),
    );

    await expect(
      submitTeacherApplication("teacher-user"),
    ).rejects.toMatchObject({
      name: "TeacherApplicationNotReadyError",
      reason: "VIDEO_MISSING",
    });
  });

  it.each([
    ["wrong provider", { provider: "youtube" }],
    ["empty upload ID", { uploadId: "" }],
    ["whitespace upload ID", { uploadId: "upload 1" }],
    ["empty asset ID", { assetId: "" }],
    ["whitespace asset ID", { assetId: "asset 1" }],
    [
      "matching upload and asset IDs",
      {
        uploadId: "same-id",
        assetId: "same-id",
      },
    ],
    ["missing duration", { durationSeconds: null }],
    ["duration below 60", { durationSeconds: 59 }],
    ["duration above 120", { durationSeconds: 121 }],
    ["UPLOAD_PENDING status", { status: "UPLOAD_PENDING" }],
    ["PROCESSING status", { status: "PROCESSING" }],
    ["REJECTED status", { status: "REJECTED" }],
    ["FAILED status", { status: "FAILED" }],
  ])(
    "rejects video that is not authoritative and ready: %s",
    async (_label, videoOverrides) => {
      mocks.userFindUnique.mockResolvedValue(
        makeUser({
          introVideo: makeVideo(videoOverrides),
        }),
      );

      await expect(
        submitTeacherApplication("teacher-user"),
      ).rejects.toMatchObject({
        name: "TeacherApplicationNotReadyError",
        reason: "VIDEO_NOT_READY",
      });

      expect(
        mocks.teacherProfileUpdateMany,
      ).not.toHaveBeenCalled();
    },
  );

  it.each([60, 120])(
    "accepts boundary duration %s seconds",
    async (durationSeconds) => {
      mocks.userFindUnique.mockResolvedValue(
        makeUser({
          introVideo: makeVideo({
            durationSeconds,
          }),
        }),
      );

      await expect(
        submitTeacherApplication("teacher-user"),
      ).resolves.toBeDefined();

      expect(
        mocks.teacherProfileUpdateMany,
      ).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects an inactive account before submission", async () => {
    mocks.userFindUnique.mockResolvedValue(
      makeUser(
        {},
        {
          accountStatus: "SUSPENDED",
        },
      ),
    );

    await expect(
      submitTeacherApplication("teacher-user"),
    ).rejects.toBeInstanceOf(
      ProfileNotFoundError,
    );

    expect(
      mocks.teacherProfileUpdateMany,
    ).not.toHaveBeenCalled();
  });

  it("rejects a non-teacher account", async () => {
    mocks.userFindUnique.mockResolvedValue(
      makeUser(
        {},
        {
          role: "STUDENT",
        },
      ),
    );

    await expect(
      submitTeacherApplication("teacher-user"),
    ).rejects.toBeInstanceOf(
      ProfileRoleMismatchError,
    );
  });

  it("fails closed when the compare-and-set update loses a race", async () => {
    mocks.userFindUnique.mockResolvedValue(
      makeUser(),
    );

    mocks.teacherProfileUpdateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      submitTeacherApplication("teacher-user"),
    ).rejects.toBeInstanceOf(
      TeacherApplicationStateError,
    );
  });

  it("does not expose provider identifiers in the applicant DTO", async () => {
    mocks.userFindUnique.mockResolvedValue(
      makeUser({
        submittedVideoUploadId: "private-submitted-upload",
        submittedVideoAssetId: "private-submitted-asset",
        introVideo: makeVideo({
          provider: "mux",
          uploadId: "private-upload",
          assetId: "private-asset",
        }),
      }),
    );

    const result =
      await getTeacherApplicationForUser(
        "teacher-user",
      );

    expect(result).not.toHaveProperty(
      "submittedVideoUploadId",
    );

    expect(result).not.toHaveProperty(
      "submittedVideoAssetId",
    );

    expect(result.introVideo).not.toHaveProperty(
      "provider",
    );

    expect(result.introVideo).not.toHaveProperty(
      "uploadId",
    );

    expect(result.introVideo).not.toHaveProperty(
      "assetId",
    );

    expect(result.introVideo).toEqual(
      expect.objectContaining({
        id: "video-1",
        revision: 3,
        durationSeconds: 90,
      }),
    );
  });

  it("returns ProfileNotFoundError when the user does not exist", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    await expect(
      submitTeacherApplication("missing-user"),
    ).rejects.toBeInstanceOf(
      ProfileNotFoundError,
    );
  });
});
