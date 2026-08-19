import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks =
  vi.hoisted(() => ({
    userFindUnique:
      vi.fn(),

    teacherProfileUpdateMany:
      vi.fn(),

    runTransaction:
      vi.fn(),

    reconcilePublicTeacherDiscoveryEligibility:
      vi.fn(),

    fromTimezoneEnum:
      vi.fn(),

    toTimezoneEnum:
      vi.fn(),
  }));

vi.mock(
  "@/lib/db/prisma",
  () => ({
    prisma: {
      user: {
        findUnique:
          mocks.userFindUnique,
      },

      $transaction:
        mocks.runTransaction,
    },
  }),
);

vi.mock(
  "@/lib/services/public-teacher-discovery-eligibility.service",
  () => ({
    reconcilePublicTeacherDiscoveryEligibility:
      mocks.reconcilePublicTeacherDiscoveryEligibility,
  }),
);

vi.mock(
  "@/lib/timezone",
  () => ({
    fromTimezoneEnum:
      mocks.fromTimezoneEnum,

    toTimezoneEnum:
      mocks.toTimezoneEnum,
  }),
);

import {
  TeacherApplicationLockedError,
} from "@/lib/errors/teacher-video-errors";
import {
  saveTeacherProfile,
} from "@/lib/services/teacher-profile.service";

const INPUT = {
  headline:
    "Conversation specialist",

  bio:
    "A detailed teacher biography for speaking practice.",

  experienceYears:
    6,

  nativeLanguage:
    "fa" as const,

  teachingLanguage:
    "en" as const,

  timezone:
    "Asia/Tehran" as const,
};

function profileRow(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    id:
      "teacher-profile-1",

    userId:
      "teacher-user",

    headline:
      "Old headline",

    bio:
      "Old biography",

    experienceYears:
      4,

    nativeLanguage:
      "fa",

    teachingLanguage:
      "en",

    timezone:
      "Asia_Tehran",

    profileCompletedAt:
      null,

    applicationStatus:
      "DRAFT",

    applicationSubmittedAt:
      null,

    applicationReviewedAt:
      null,

    applicationReviewNote:
      null,

    profileRevision:
      3,

    createdAt:
      new Date(
        "2026-08-01T00:00:00.000Z",
      ),

    updatedAt:
      new Date(
        "2026-08-01T00:00:00.000Z",
      ),

    introVideo:
      null,

    ...overrides,
  };
}

function activeTeacher(
  profile:
    ReturnType<typeof profileRow>,
) {
  return {
    accountStatus:
      "ACTIVE",

    role:
      "TEACHER",

    teacherProfile:
      profile,
  };
}

describe(
  "teacher profile transactional discovery reconciliation",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      mocks
        .fromTimezoneEnum
        .mockReturnValue(
          "Asia/Tehran",
        );

      mocks
        .toTimezoneEnum
        .mockReturnValue(
          "Asia_Tehran",
        );

      mocks
        .teacherProfileUpdateMany
        .mockResolvedValue({
          count:
            1,
        });

      mocks
        .reconcilePublicTeacherDiscoveryEligibility
        .mockResolvedValue(
          false,
        );

      mocks
        .runTransaction
        .mockImplementation(
          async (
            work: (
              tx: {
                teacherProfile: {
                  updateMany:
                    typeof mocks.teacherProfileUpdateMany;
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

            return work(
              tx,
            );
          },
        );
    });

    it(
      "uses the same transaction client for profile mutation and discovery reconciliation",
      async () => {
        const current =
          profileRow();

        const updated =
          profileRow({
            headline:
              INPUT.headline,

            profileCompletedAt:
              new Date(
                "2026-08-18T18:00:00.000Z",
              ),

            profileRevision:
              4,
          });

        mocks.userFindUnique
          .mockResolvedValueOnce(
            activeTeacher(
              current,
            ),
          )
          .mockResolvedValueOnce(
            activeTeacher(
              updated,
            ),
          );

        const tx = {
          teacherProfile: {
            updateMany:
              mocks.teacherProfileUpdateMany,
          },
        };

        mocks.runTransaction
          .mockImplementationOnce(
            async (
              work: (
                transaction:
                  typeof tx,
              ) => Promise<unknown>,
            ) =>
              work(
                tx,
              ),
          );

        await saveTeacherProfile(
          "teacher-user",
          INPUT,
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
          mocks.teacherProfileUpdateMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id:
                "teacher-profile-1",

              profileRevision:
                3,

              applicationStatus: {
                in: [
                  "DRAFT",
                  "REJECTED",
                ],
              },

              user: {
                accountStatus:
                  "ACTIVE",
              },
            },

            data:
              expect.objectContaining({
                headline:
                  INPUT.headline,

                bio:
                  INPUT.bio,

                experienceYears:
                  INPUT.experienceYears,

                nativeLanguage:
                  INPUT.nativeLanguage,

                teachingLanguage:
                  INPUT.teachingLanguage,

                timezone:
                  "Asia_Tehran",

                profileCompletedAt:
                  expect.any(
                    Date,
                  ),

                profileRevision: {
                  increment:
                    1,
                },
              }),
          }),
        );

        expect(
          mocks
            .reconcilePublicTeacherDiscoveryEligibility,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks
            .reconcilePublicTeacherDiscoveryEligibility,
        ).toHaveBeenCalledWith(
          "teacher-profile-1",
          tx,
        );
      },
    );

    it(
      "preserves an existing profile completion timestamp",
      async () => {
        const completedAt =
          new Date(
            "2026-08-10T08:00:00.000Z",
          );

        mocks.userFindUnique
          .mockResolvedValueOnce(
            activeTeacher(
              profileRow({
                profileCompletedAt:
                  completedAt,
              }),
            ),
          )
          .mockResolvedValueOnce(
            activeTeacher(
              profileRow({
                profileCompletedAt:
                  completedAt,

                profileRevision:
                  4,
              }),
            ),
          );

        await saveTeacherProfile(
          "teacher-user",
          INPUT,
        );

        const update =
          mocks
            .teacherProfileUpdateMany
            .mock.calls[0]?.[0];

        expect(
          update.data
            .profileCompletedAt,
        ).toBe(
          completedAt,
        );
      },
    );

    it(
      "fails closed when the compare-and-set update loses a race and never reconciles",
      async () => {
        mocks.userFindUnique
          .mockResolvedValue(
            activeTeacher(
              profileRow(),
            ),
          );

        mocks
          .teacherProfileUpdateMany
          .mockResolvedValueOnce({
            count:
              0,
          });

        await expect(
          saveTeacherProfile(
            "teacher-user",
            INPUT,
          ),
        ).rejects.toBeInstanceOf(
          TeacherApplicationLockedError,
        );

        expect(
          mocks
            .reconcilePublicTeacherDiscoveryEligibility,
        ).not.toHaveBeenCalled();

        expect(
          mocks.userFindUnique,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      "rejects approved applications before opening the mutation transaction",
      async () => {
        mocks.userFindUnique
          .mockResolvedValue(
            activeTeacher(
              profileRow({
                applicationStatus:
                  "APPROVED",
              }),
            ),
          );

        await expect(
          saveTeacherProfile(
            "teacher-user",
            INPUT,
          ),
        ).rejects.toBeInstanceOf(
          TeacherApplicationLockedError,
        );

        expect(
          mocks.runTransaction,
        ).not.toHaveBeenCalled();

        expect(
          mocks
            .teacherProfileUpdateMany,
        ).not.toHaveBeenCalled();

        expect(
          mocks
            .reconcilePublicTeacherDiscoveryEligibility,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
