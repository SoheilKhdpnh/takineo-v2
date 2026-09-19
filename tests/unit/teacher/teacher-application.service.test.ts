import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  teacherProfileUpdateMany: vi.fn(),
  runTransaction: vi.fn(),
  reconcilePublicTeacherDiscoveryEligibility: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
    },
    teacherProfile: {
      updateMany: mocks.teacherProfileUpdateMany,
    },
    $transaction: mocks.runTransaction,
  },
}));
vi.mock(
  "@/lib/services/public-teacher-discovery-eligibility.service",
  () => ({
    reconcilePublicTeacherDiscoveryEligibility:
      mocks.reconcilePublicTeacherDiscoveryEligibility,
  }),
);

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
    provider: "aparat",
    aparatUrl: "https://www.aparat.com/v/abcDE12",
    aparatHash: "abcDE12",
    status: "READY_FOR_REVIEW",
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
    submittedAparatHash: null,

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
    mocks.runTransaction.mockReset();
    mocks.reconcilePublicTeacherDiscoveryEligibility.mockReset();

    mocks.teacherProfileUpdateMany.mockResolvedValue({
      count: 1,
    });

    mocks.reconcilePublicTeacherDiscoveryEligibility.mockResolvedValue(
      false,
    );

    mocks.runTransaction.mockImplementation(
      async (
        work: (
          tx: {
            teacherProfile: {
              updateMany: typeof mocks.teacherProfileUpdateMany;
            };
          },
        ) => Promise<unknown>,
      ) => {
        const tx = {
          teacherProfile: {
            updateMany:
              mocks.teacherProfileUpdateMany,
          },
        };

        return work(tx);
      },
    );
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
        provider: "aparat",
        aparatHash: "abcDE12",
        status: "READY_FOR_REVIEW",
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
        submittedAparatHash: "abcDE12",
      }),
    );

    expect(mocks.runTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        maxWait: 10_000,
        timeout: 30_000,
      },
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
    ["empty hash", { aparatHash: "" }],
    ["whitespace hash", { aparatHash: "abc DE" }],
    ["missing url", { aparatUrl: null }],
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

  it("accepts a valid Aparat video that is ready for review", async () => {
    mocks.userFindUnique.mockResolvedValue(makeUser());

    await expect(
      submitTeacherApplication("teacher-user"),
    ).resolves.toBeDefined();

    expect(mocks.teacherProfileUpdateMany).toHaveBeenCalledTimes(1);
  });

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
        submittedAparatHash: "private-submitted-hash",
        introVideo: makeVideo({
          provider: "aparat",
          aparatHash: "private-hash",
        }),
      }),
    );

    const result =
      await getTeacherApplicationForUser(
        "teacher-user",
      );

    expect(result).not.toHaveProperty(
      "submittedAparatHash",
    );

    expect(result.introVideo).not.toHaveProperty(
      "provider",
    );

    expect(result.introVideo).not.toHaveProperty(
      "aparatHash",
    );

    expect(result.introVideo).toEqual(
      expect.objectContaining({
        id: "video-1",
        revision: 3,
        aparatUrl: "https://www.aparat.com/v/abcDE12",
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

  it("uses the same transaction client for submission and discovery reconciliation", async () => {
    mocks.userFindUnique.mockResolvedValue(
      makeUser(),
    );

    const tx = {
      teacherProfile: {
        updateMany:
          mocks.teacherProfileUpdateMany,
      },
    };

    mocks.runTransaction.mockImplementationOnce(
      async (
        work: (
          transaction:
            typeof tx,
        ) => Promise<unknown>,
      ) =>
        work(tx),
    );

    await submitTeacherApplication(
      "teacher-user",
    );

    expect(
      mocks.runTransaction,
    ).toHaveBeenCalledTimes(
      1,
    );

    expect(
      mocks.teacherProfileUpdateMany,
    ).toHaveBeenCalledTimes(
      1,
    );

    expect(
      mocks.reconcilePublicTeacherDiscoveryEligibility,
    ).toHaveBeenCalledTimes(
      1,
    );

    expect(
      mocks.reconcilePublicTeacherDiscoveryEligibility,
    ).toHaveBeenCalledWith(
      "teacher-profile-1",
      tx,
    );
  });

  it("does not reconcile discovery membership when the submission compare-and-set loses the race", async () => {
    mocks.userFindUnique.mockResolvedValue(
      makeUser(),
    );

    mocks.teacherProfileUpdateMany.mockResolvedValueOnce({
      count: 0,
    });

    await expect(
      submitTeacherApplication(
        "teacher-user",
      ),
    ).rejects.toBeInstanceOf(
      TeacherApplicationStateError,
    );

    expect(
      mocks.reconcilePublicTeacherDiscoveryEligibility,
    ).not.toHaveBeenCalled();
  });
});
