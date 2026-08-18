import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks =
  vi.hoisted(() => ({
    prisma: {
      teacherProfile: {
        findUnique:
          vi.fn(),
      },
    },
  }));

vi.mock(
  "@/lib/db/prisma",
  () => ({
    prisma:
      mocks.prisma,
  }),
);

import {
  BookableTeacherNotFoundError,
} from "@/lib/errors/booking-errors";

import {
  getPublicTeacherDetail,
} from "@/lib/services/teacher-discovery.service";

const publicRow = {
  id:
    "teacher-profile-1",

  headline:
    "Speaking coach",

  bio:
    "Six years helping learners speak confidently.",

  experienceYears:
    6,

  nativeLanguage:
    "fa",

  teachingLanguage:
    "en",

  applicationStatus:
    "APPROVED",

  profileCompletedAt:
    new Date(
      "2026-08-01T00:00:00.000Z",
    ),

  user: {
    name:
      "Teacher One",

    image:
      "https://example.test/teacher.jpg",

    accountStatus:
      "ACTIVE",
  },

  introVideo: {
    status:
      "APPROVED",
  },
};

beforeEach(() => {
  vi.clearAllMocks();

  mocks.prisma
    .teacherProfile
    .findUnique
    .mockResolvedValue(
      publicRow,
    );
});

describe(
  "public teacher detail service",
  () => {
    it(
      "returns only an explicit public-detail allowlist",
      async () => {
        const result =
          await getPublicTeacherDetail(
            "teacher-profile-1",
          );

        expect(
          result,
        ).toEqual({
          teacherProfileId:
            "teacher-profile-1",

          name:
            "Teacher One",

          image:
            "https://example.test/teacher.jpg",

          headline:
            "Speaking coach",

          bio:
            "Six years helping learners speak confidently.",

          experienceYears:
            6,

          nativeLanguage:
            "fa",

          teachingLanguage:
            "en",
        });

        expect(
          mocks.prisma
            .teacherProfile
            .findUnique,
        ).toHaveBeenCalledWith({
          where: {
            id:
              "teacher-profile-1",
          },

          select: {
            id:
              true,

            headline:
              true,

            bio:
              true,

            experienceYears:
              true,

            nativeLanguage:
              true,

            teachingLanguage:
              true,

            applicationStatus:
              true,

            profileCompletedAt:
              true,

            user: {
              select: {
                name:
                  true,

                image:
                  true,

                accountStatus:
                  true,
              },
            },

            introVideo: {
              select: {
                status:
                  true,
              },
            },
          },
        });

        const serialized =
          JSON.stringify(
            result,
          );

        for (
          const forbidden
          of [
            "applicationStatus",
            "profileCompletedAt",
            "applicationReviewNote",
            "reviewCycle",
            "submittedVideoId",
            "submittedVideoUploadId",
            "submittedVideoAssetId",
            "reviewPlaybackId",
            "email",
          ]
        ) {
          expect(
            serialized,
          ).not.toContain(
            forbidden,
          );
        }
      },
    );

    it(
      "fails closed for a teacher that is no longer publicly bookable",
      async () => {
        mocks.prisma
          .teacherProfile
          .findUnique
          .mockResolvedValueOnce({
            ...publicRow,

            applicationStatus:
              "SUSPENDED",
          });

        await expect(
          getPublicTeacherDetail(
            "teacher-profile-1",
          ),
        ).rejects.toBeInstanceOf(
          BookableTeacherNotFoundError,
        );
      },
    );

    it(
      "makes missing and non-public teachers indistinguishable",
      async () => {
        mocks.prisma
          .teacherProfile
          .findUnique
          .mockResolvedValueOnce(
            null,
          );

        await expect(
          getPublicTeacherDetail(
            "teacher-profile-1",
          ),
        ).rejects.toBeInstanceOf(
          BookableTeacherNotFoundError,
        );
      },
    );

    it(
      "rejects malformed identifiers before database access",
      async () => {
        await expect(
          getPublicTeacherDetail(
            " teacher-profile-1",
          ),
        ).rejects.toBeInstanceOf(
          BookableTeacherNotFoundError,
        );

        expect(
          mocks.prisma
            .teacherProfile
            .findUnique,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
