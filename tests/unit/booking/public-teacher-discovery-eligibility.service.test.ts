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
        findMany:
          vi.fn(),
      },

      publicTeacherDiscoveryEligibility: {
        findMany:
          vi.fn(),
      },

      $transaction:
        vi.fn(),
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
  auditPublicTeacherDiscoveryEligibility,
  reconcilePublicTeacherDiscoveryEligibility,
} from "@/lib/services/public-teacher-discovery-eligibility.service";

function eligibilityRow(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    id:
      "teacher-1",

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

    ...overrides,
  };
}

function makeTx(
  teacher:
    ReturnType<typeof eligibilityRow> | null,
) {
  return {
    teacherProfile: {
      findUnique:
        vi.fn().mockResolvedValue(
          teacher,
        ),
    },

    publicTeacherDiscoveryEligibility: {
      upsert:
        vi.fn().mockResolvedValue({
          teacherProfileId:
            "teacher-1",
        }),

      deleteMany:
        vi.fn().mockResolvedValue({
          count:
            1,
        }),
    },
  };
}

describe(
  "public teacher discovery eligibility projection",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      mocks.prisma
        .teacherProfile
        .findMany
        .mockResolvedValue(
          [],
        );

      mocks.prisma
        .publicTeacherDiscoveryEligibility
        .findMany
        .mockResolvedValue(
          [],
        );
    });

    it(
      "inserts membership when the canonical policy says the teacher is public",
      async () => {
        const tx =
          makeTx(
            eligibilityRow(),
          );

        await reconcilePublicTeacherDiscoveryEligibility(
          "teacher-1",
          tx as never,
        );

        expect(
          tx.publicTeacherDiscoveryEligibility.upsert,
        ).toHaveBeenCalledWith({
          where: {
            teacherProfileId:
              "teacher-1",
          },

          create: {
            teacherProfileId:
              "teacher-1",
          },

          update: {},
        });

        expect(
          tx.publicTeacherDiscoveryEligibility.deleteMany,
        ).not.toHaveBeenCalled();
      },
    );

    it.each([
      [
        "inactive account",
        {
          user: {
            accountStatus:
              "SUSPENDED",
          },
        },
      ],

      [
        "application not approved",
        {
          applicationStatus:
            "SUSPENDED",
        },
      ],

      [
        "incomplete profile",
        {
          profileCompletedAt:
            null,
        },
      ],

      [
        "video not approved",
        {
          introVideo: {
            status:
              "REJECTED",
          },
        },
      ],

      [
        "video missing",
        {
          introVideo:
            null,
        },
      ],
    ])(
      "removes membership for %s",
      async (
        _label,
        overrides,
      ) => {
        const tx =
          makeTx(
            eligibilityRow(
              overrides,
            ),
          );

        await reconcilePublicTeacherDiscoveryEligibility(
          "teacher-1",
          tx as never,
        );

        expect(
          tx.publicTeacherDiscoveryEligibility.deleteMany,
        ).toHaveBeenCalledWith({
          where: {
            teacherProfileId:
              "teacher-1",
          },
        });

        expect(
          tx.publicTeacherDiscoveryEligibility.upsert,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "removes orphan membership when the teacher profile no longer exists",
      async () => {
        const tx =
          makeTx(
            null,
          );

        await reconcilePublicTeacherDiscoveryEligibility(
          "teacher-1",
          tx as never,
        );

        expect(
          tx.publicTeacherDiscoveryEligibility.deleteMany,
        ).toHaveBeenCalledWith({
          where: {
            teacherProfileId:
              "teacher-1",
          },
        });
      },
    );

    it(
      "uses only the canonical eligibility source fields",
      async () => {
        const tx =
          makeTx(
            eligibilityRow(),
          );

        await reconcilePublicTeacherDiscoveryEligibility(
          "teacher-1",
          tx as never,
        );

        const query =
          tx.teacherProfile
            .findUnique
            .mock.calls[0]?.[0];

        expect(
          query,
        ).toEqual({
          where: {
            id:
              "teacher-1",
          },

          select: {
            id:
              true,

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
          },
        });

        expect(
          JSON.stringify(
            query,
          ),
        ).not.toContain(
          "email",
        );

        expect(
          JSON.stringify(
            query,
          ),
        ).not.toContain(
          "applicationReviewNote",
        );
      },
    );

    it(
      "detects missing and stale projection membership without defining a second eligibility policy",
      async () => {
        mocks.prisma
          .publicTeacherDiscoveryEligibility
          .findMany
          .mockResolvedValue([
            {
              teacherProfileId:
                "teacher-stale",
            },
            {
              teacherProfileId:
                "teacher-public",
            },
          ]);

        mocks.prisma
          .teacherProfile
          .findMany
          .mockResolvedValueOnce([
            eligibilityRow({
              id:
                "teacher-public",
            }),

            eligibilityRow({
              id:
                "teacher-missing",
            }),

            eligibilityRow({
              id:
                "teacher-stale",

              applicationStatus:
                "SUSPENDED",
            }),
          ])
          .mockResolvedValueOnce(
            [],
          );

        const audit =
          await auditPublicTeacherDiscoveryEligibility();

        expect(
          audit,
        ).toEqual({
          checkedTeacherProfiles:
            3,

          projectionRows:
            2,

          missingMembershipIds: [
            "teacher-missing",
          ],

          staleMembershipIds: [
            "teacher-stale",
          ],

          inSync:
            false,
        });
      },
    );
  },
);
