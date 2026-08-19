import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  assertNoForbiddenPublicFields,
} from "@/tests/support/discovery-complexity-guard";

const mocks = vi.hoisted(() => ({
  prisma: {
    publicTeacherDiscoveryEligibility: {
      findMany:
        vi.fn(),
    },

    teacherProfile: {
      findMany:
        vi.fn(),
    },
  },

  getNextBookableAvailabilityForTeachers:
    vi.fn(),
}));

vi.mock(
  "@/lib/db/prisma",
  () => ({
    prisma:
      mocks.prisma,
  }),
);

vi.mock(
  "@/lib/services/bookable-slots.service",
  async () => {
    const actual =
      await vi.importActual<
        typeof import("@/lib/services/bookable-slots.service")
      >(
        "@/lib/services/bookable-slots.service",
      );

    return {
      ...actual,

      getNextBookableAvailabilityForTeachers:
        mocks
          .getNextBookableAvailabilityForTeachers,
    };
  },
);

import {
  listPublicTeachers,
  TEACHER_DISCOVERY_MAX_PAGE_SIZE,
} from "@/lib/services/teacher-discovery.service";

const NOW =
  new Date(
    "2026-08-18T08:00:00.000Z",
  );

const RANGE = {
  fromDate:
    "2026-08-18",

  toDate:
    "2026-08-24",
};

function candidate(
  id: string,
  overrides:
    Record<string, unknown> = {},
) {
  const row = {
    id,

    headline:
      `Headline ${id}`,

    experienceYears:
      7,

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

    /*
     * Deliberate poison fields. Correct public mapping must
     * never serialize these even if a mocked/compromised
     * repository row contains them.
     */
    applicationReviewNote:
      "TRACK-D-PRIVATE-REVIEW-NOTE",

    applicationSubmittedAt:
      new Date(
        "2026-07-01T00:00:00.000Z",
      ),

    applicationReviewedAt:
      new Date(
        "2026-07-02T00:00:00.000Z",
      ),

    reviewCycle:
      99,

    submittedVideoAssetId:
      "TRACK-D-PRIVATE-ASSET",

    submittedVideoUploadId:
      "TRACK-D-PRIVATE-UPLOAD",

    user: {
      name:
        `Teacher ${id}`,

      image:
        null,

      accountStatus:
        "ACTIVE",

      email:
        `${id}@track-d.private`,

      phone:
        "+980000000000",
    },

    introVideo: {
      status:
        "APPROVED",

      rejectionReason:
        "TRACK-D-PRIVATE-REJECTION",

      reviewPlaybackId:
        "TRACK-D-PRIVATE-PLAYBACK",
    },
  };

  return {
    ...row,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.prisma
    .publicTeacherDiscoveryEligibility
    .findMany
    .mockResolvedValue([]);

  mocks.prisma
    .teacherProfile
    .findMany
    .mockResolvedValue([]);

  mocks
    .getNextBookableAvailabilityForTeachers
    .mockResolvedValue(
      new Map(),
    );
});

describe(
  "Track D M3 discovery service adversarial verification",
  () => {
    it(
      "keeps private review/account/provider fields outside the public DTO even when repository rows are poisoned",
      async () => {
        mocks.prisma
          .publicTeacherDiscoveryEligibility
          .findMany
          .mockResolvedValue([
            {
              teacherProfileId:
                "teacher-public",
            },
          ]);

        mocks.prisma
          .teacherProfile
          .findMany
          .mockResolvedValue([
            candidate(
              "teacher-public",
            ),
          ]);

        mocks
          .getNextBookableAvailabilityForTeachers
          .mockResolvedValue(
            new Map([
              [
                "teacher-public",
                new Date(
                  "2026-08-20T05:30:00.000Z",
                ),
              ],
            ]),
          );

        const result =
          await listPublicTeachers(
            {
              limit:
                20,

              ...RANGE,
            },
            {
              now:
                NOW,
            },
          );

        expect(
          result.teachers,
        ).toHaveLength(
          1,
        );

        expect(
          Object.keys(
            result.teachers[0] ??
              {},
          ).sort(),
        ).toEqual(
          [
            "experienceYears",
            "headline",
            "image",
            "name",
            "nativeLanguage",
            "nextAvailableAt",
            "teacherProfileId",
            "teachingLanguage",
          ].sort(),
        );

        assertNoForbiddenPublicFields(
          result,
        );

        const serialized =
          JSON.stringify(
            result,
          );

        expect(
          serialized,
        ).not.toContain(
          "TRACK-D-PRIVATE",
        );

        expect(
          serialized,
        ).not.toContain(
          "@track-d.private",
        );

        expect(
          serialized,
        ).not.toContain(
          "+980000000000",
        );
      },
    );

    it(
      "trusts canonical projection membership and keeps poisoned non-member rows out of batched availability",
      async () => {
        mocks.prisma
          .publicTeacherDiscoveryEligibility
          .findMany
          .mockResolvedValue([
            {
              teacherProfileId:
                "teacher-public",
            },
          ]);

        /*
         * Deliberately poison the mocked profile repository with rows that
         * are not members of the public projection. The service must restore
         * page order from projection IDs and must never let these rows expand
         * downstream availability work.
         */
        mocks.prisma
          .teacherProfile
          .findMany
          .mockResolvedValue([
            candidate(
              "teacher-public",
            ),

            candidate(
              "teacher-suspended",
              {
                applicationStatus:
                  "SUSPENDED",
              },
            ),

            candidate(
              "teacher-inactive-account",
              {
                user: {
                  name:
                    "Inactive",

                  image:
                    null,

                  accountStatus:
                    "SUSPENDED",
                },
              },
            ),

            candidate(
              "teacher-incomplete",
              {
                profileCompletedAt:
                  null,
              },
            ),

            candidate(
              "teacher-video-pending",
              {
                introVideo: {
                  status:
                    "READY_FOR_REVIEW",
                },
              },
            ),
          ]);

        mocks
          .getNextBookableAvailabilityForTeachers
          .mockResolvedValue(
            new Map([
              [
                "teacher-public",
                null,
              ],
            ]),
          );

        const result =
          await listPublicTeachers(
            {
              limit:
                20,

              ...RANGE,
            },
            {
              now:
                NOW,
            },
          );

        expect(
          result.teachers.map(
            (
              teacher,
            ) =>
              teacher.teacherProfileId,
          ),
        ).toEqual([
          "teacher-public",
        ]);

        expect(
          mocks.prisma
            .teacherProfile
            .findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id: {
                in: [
                  "teacher-public",
                ],
              },
            },
          }),
        );

        expect(
          mocks
            .getNextBookableAvailabilityForTeachers,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks
            .getNextBookableAvailabilityForTeachers,
        ).toHaveBeenCalledWith(
          [
            "teacher-public",
          ],
          RANGE,
          {
            now:
              NOW,
          },
        );
      },
    );
    it.each([
      0,
      -1,
      TEACHER_DISCOVERY_MAX_PAGE_SIZE +
        1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])(
      "rejects hostile direct-service page size %s before PostgreSQL access",
      async (
        limit,
      ) => {
        await expect(
          listPublicTeachers(
            {
              limit,
              ...RANGE,
            },
            {
              now:
                NOW,
            },
          ),
        ).rejects.toBeInstanceOf(
          RangeError,
        );

        expect(
          mocks.prisma
            .teacherProfile
            .findMany,
        ).not.toHaveBeenCalled();

        expect(
          mocks
            .getNextBookableAvailabilityForTeachers,
        ).not.toHaveBeenCalled();
      },
    );

    it.each([
      "",
      " leading",
      "trailing ",
      " ",
      "\tteacher",
    ])(
      "rejects non-canonical cursor %j before PostgreSQL access",
      async (
        cursor,
      ) => {
        await expect(
          listPublicTeachers(
            {
              limit:
                20,

              cursor,

              ...RANGE,
            },
            {
              now:
                NOW,
            },
          ),
        ).rejects.toBeInstanceOf(
          RangeError,
        );

        expect(
          mocks.prisma
            .teacherProfile
            .findMany,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "keeps projection candidate hunting and downstream profile/availability work page-bounded",
      async () => {
        const rows =
          Array.from(
            {
              length:
                TEACHER_DISCOVERY_MAX_PAGE_SIZE +
                1,
            },
            (
              _,
              index,
            ) =>
              candidate(
                `teacher-${String(
                  index,
                ).padStart(
                  3,
                  "0",
                )}`,
              ),
          );

        const memberships =
          rows.map(
            (
              row,
            ) => ({
              teacherProfileId:
                row.id,
            }),
          );

        const pageRows =
          rows.slice(
            0,
            TEACHER_DISCOVERY_MAX_PAGE_SIZE,
          );

        const pageIds =
          pageRows.map(
            (
              row,
            ) =>
              row.id,
          );

        mocks.prisma
          .publicTeacherDiscoveryEligibility
          .findMany
          .mockResolvedValue(
            memberships,
          );

        mocks.prisma
          .teacherProfile
          .findMany
          .mockResolvedValue(
            pageRows,
          );

        mocks
          .getNextBookableAvailabilityForTeachers
          .mockResolvedValue(
            new Map(
              pageRows.map(
                (
                  row,
                ) => [
                  row.id,
                  null,
                ],
              ),
            ),
          );

        const result =
          await listPublicTeachers(
            {
              limit:
                TEACHER_DISCOVERY_MAX_PAGE_SIZE,

              ...RANGE,
            },
            {
              now:
                NOW,
            },
          );

        expect(
          result.teachers,
        ).toHaveLength(
          TEACHER_DISCOVERY_MAX_PAGE_SIZE,
        );

        expect(
          mocks.prisma
            .publicTeacherDiscoveryEligibility
            .findMany,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks.prisma
            .publicTeacherDiscoveryEligibility
            .findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            take:
              TEACHER_DISCOVERY_MAX_PAGE_SIZE +
              1,

            orderBy: {
              teacherProfileId:
                "asc",
            },

            select: {
              teacherProfileId:
                true,
            },
          }),
        );

        expect(
          mocks.prisma
            .teacherProfile
            .findMany,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks.prisma
            .teacherProfile
            .findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id: {
                in:
                  pageIds,
              },
            },
          }),
        );

        const projectedIds =
          mocks
            .getNextBookableAvailabilityForTeachers
            .mock
            .calls[0]?.[0];

        expect(
          projectedIds,
        ).toEqual(
          pageIds,
        );

        expect(
          projectedIds,
        ).not.toContain(
          rows.at(-1)?.id,
        );
      },
    );  },
);
