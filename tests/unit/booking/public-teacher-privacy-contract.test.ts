import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    teacherProfile: {
      findUnique: vi.fn(),
    },

    teacherAvailabilityRule: {
      findMany: vi.fn(),
    },

    teacherAvailabilityException: {
      findMany: vi.fn(),
    },

    speakingSession: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock(
  "@/lib/db/prisma",
  () => ({
    prisma: mocks.prisma,
  }),
);

import {
  getBookableSlotsForTeacher,
} from "@/lib/services/bookable-slots.service";

describe(
  "Wave 2 public teacher privacy contract",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      mocks.prisma
        .teacherProfile
        .findUnique
        .mockResolvedValue({
          id: "teacher-profile-1",

          applicationStatus:
            "APPROVED",

          profileCompletedAt:
            new Date(
              "2026-08-01T00:00:00.000Z",
            ),

          user: {
            accountStatus:
              "ACTIVE",
          },

          introVideo: {
            status:
              "APPROVED",
          },

          /*
           * Deliberately malicious mock fields.
           *
           * Real Prisma would omit these because
           * the service uses an allowlisted select.
           * Keeping them here proves the service
           * also does not spread its internal
           * eligibility row into the public result.
           */
          applicationReviewNote:
            "private moderation note",

          applicationSubmittedAt:
            new Date(
              "2026-07-20T00:00:00.000Z",
            ),

          applicationReviewedAt:
            new Date(
              "2026-07-22T00:00:00.000Z",
            ),

          reviewCycle:
            7,

          submittedProfileRevision:
            12,

          submittedVideoId:
            "private-video-id",

          submittedVideoRevision:
            4,

          submittedVideoUploadId:
            "private-upload-id",

          submittedVideoAssetId:
            "private-asset-id",
        });

      mocks.prisma
        .teacherAvailabilityRule
        .findMany
        .mockResolvedValue([]);

      mocks.prisma
        .teacherAvailabilityException
        .findMany
        .mockResolvedValue([]);

      mocks.prisma
        .speakingSession
        .findMany
        .mockResolvedValue([]);
    });

    it(
      "uses review state only for internal eligibility and never serializes it publicly",
      async () => {
        const result =
          await getBookableSlotsForTeacher(
            "teacher-profile-1",
            {
              fromDate:
                "2026-08-15",

              toDate:
                "2026-08-15",
            },
            {
              now:
                new Date(
                  "2026-08-10T08:00:00.000Z",
                ),
            },
          );

        const teacherQuery =
          mocks.prisma
            .teacherProfile
            .findUnique
            .mock.calls[0][0];

        expect(
          teacherQuery.select,
        ).toEqual({
          id: true,

          applicationStatus:
            true,

          profileCompletedAt:
            true,

          user: {
            select: {
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
        });

        expect(
          teacherQuery.select
            .applicationReviewNote,
        ).toBeUndefined();

        expect(
          teacherQuery.select
            .applicationSubmittedAt,
        ).toBeUndefined();

        expect(
          teacherQuery.select
            .applicationReviewedAt,
        ).toBeUndefined();

        expect(
          teacherQuery.select
            .reviewCycle,
        ).toBeUndefined();

        expect(
          teacherQuery.select
            .submittedProfileRevision,
        ).toBeUndefined();

        expect(
          teacherQuery.select
            .submittedVideoId,
        ).toBeUndefined();

        expect(result).toEqual({
          teacherProfileId:
            "teacher-profile-1",

          timezone:
            "Asia/Tehran",

          fromDate:
            "2026-08-15",

          toDate:
            "2026-08-15",

          slots: [],
        });

        expect(
          result,
        ).not.toHaveProperty(
          "applicationStatus",
        );

        expect(
          result,
        ).not.toHaveProperty(
          "profileCompletedAt",
        );

        const serialized =
          JSON.stringify(result);

        for (const privateValue of [
          "private moderation note",
          "private-video-id",
          "private-upload-id",
          "private-asset-id",
        ]) {
          expect(
            serialized,
          ).not.toContain(
            privateValue,
          );
        }
      },
    );
  },
);
