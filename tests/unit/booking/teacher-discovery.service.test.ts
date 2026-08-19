import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const mocks =
  vi.hoisted(() => ({
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

    validateBookableSlotsRange:
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
  () => ({
    getNextBookableAvailabilityForTeachers:
      mocks
        .getNextBookableAvailabilityForTeachers,

    validateBookableSlotsRange:
      mocks
        .validateBookableSlotsRange,
  }),
);

import {
  BookableSlotsRangeError,
} from "@/lib/errors/booking-errors";

import {
  listPublicTeachers,
} from "@/lib/services/teacher-discovery.service";

const NOW =
  new Date(
    "2026-08-17T08:00:00.000Z",
  );

const RANGE = {
  fromDate:
    "2026-08-17",

  toDate:
    "2026-08-23",
};

function publicTeacherRow(
  id:
    string,
) {
  return {
    id,

    headline:
      `Headline ${id}`,

    experienceYears:
      7,

    nativeLanguage:
      "fa",

    teachingLanguage:
      "en",

    /*
     * Deliberately injected private fields.
     * The public select / DTO must never expose them.
     */
    applicationReviewNote:
      "PRIVATE ADMIN NOTE",

    reviewCycle:
      9,

    submittedVideoAssetId:
      "PRIVATE-ASSET",

    user: {
      name:
        `Teacher ${id}`,

      image:
        `https://example.test/${id}.jpg`,

      email:
        `${id}@private.example.test`,
    },
  };
}

function membership(
  teacherProfileId:
    string,
) {
  return {
    teacherProfileId,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.prisma
    .publicTeacherDiscoveryEligibility
    .findMany
    .mockResolvedValue(
      [],
    );

  mocks.prisma
    .teacherProfile
    .findMany
    .mockResolvedValue(
      [],
    );

  mocks
    .validateBookableSlotsRange
    .mockImplementation(
      () =>
        undefined,
    );

  mocks
    .getNextBookableAvailabilityForTeachers
    .mockResolvedValue(
      new Map(),
    );
});

describe(
  "public teacher discovery",
  () => {
    test(
      "validates the booking date range before any candidate query",
      async () => {
        mocks
          .validateBookableSlotsRange
          .mockImplementationOnce(
            () => {
              throw new BookableSlotsRangeError(
                "INVALID_DATE_RANGE",
              );
            },
          );

        await expect(
          listPublicTeachers(
            {
              limit:
                20,

              fromDate:
                "2026-08-23",

              toDate:
                "2026-08-17",
            },
            {
              now:
                NOW,
            },
          ),
        ).rejects.toBeInstanceOf(
          BookableSlotsRangeError,
        );

        expect(
          mocks.prisma
            .publicTeacherDiscoveryEligibility
            .findMany,
        ).not.toHaveBeenCalled();

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

    test(
      "reads only limit plus one candidate identifiers from the eligibility projection",
      async () => {
        await listPublicTeachers(
          {
            limit:
              40,

            cursor:
              "teacher-previous",

            ...RANGE,
          },
          {
            now:
              NOW,
          },
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
        ).toHaveBeenCalledWith({
          where: {
            teacherProfileId: {
              gt:
                "teacher-previous",
            },
          },

          orderBy: {
            teacherProfileId:
              "asc",
          },

          take:
            41,

          select: {
            teacherProfileId:
              true,
          },
        });
      },
    );

    test(
      "does not fetch profiles or availability when the projection page is empty",
      async () => {
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
          result,
        ).toEqual({
          teachers:
            [],

          nextCursor:
            null,
        });

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

    test(
      "fetches public DTO fields only for the bounded projected page",
      async () => {
        mocks.prisma
          .publicTeacherDiscoveryEligibility
          .findMany
          .mockResolvedValue([
            membership(
              "teacher-a",
            ),
          ]);

        mocks.prisma
          .teacherProfile
          .findMany
          .mockResolvedValue([
            publicTeacherRow(
              "teacher-a",
            ),
          ]);

        mocks
          .getNextBookableAvailabilityForTeachers
          .mockResolvedValue(
            new Map([
              [
                "teacher-a",
                new Date(
                  "2026-08-18T05:30:00.000Z",
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
          result,
        ).toEqual({
          teachers: [
            {
              teacherProfileId:
                "teacher-a",

              name:
                "Teacher teacher-a",

              image:
                "https://example.test/teacher-a.jpg",

              headline:
                "Headline teacher-a",

              experienceYears:
                7,

              nativeLanguage:
                "fa",

              teachingLanguage:
                "en",

              nextAvailableAt:
                new Date(
                  "2026-08-18T05:30:00.000Z",
                ),
            },
          ],

          nextCursor:
            null,
        });

        expect(
          mocks.prisma
            .teacherProfile
            .findMany,
        ).toHaveBeenCalledWith({
          where: {
            id: {
              in: [
                "teacher-a",
              ],
            },
          },

          select: {
            id:
              true,

            headline:
              true,

            experienceYears:
              true,

            nativeLanguage:
              true,

            teachingLanguage:
              true,

            user: {
              select: {
                name:
                  true,

                image:
                  true,
              },
            },
          },
        });

        const query =
          mocks.prisma
            .teacherProfile
            .findMany
            .mock
            .calls[0]?.[0];

        const serialized =
          JSON.stringify(
            query,
          );

        expect(
          serialized,
        ).not.toContain(
          "applicationStatus",
        );

        expect(
          serialized,
        ).not.toContain(
          "profileCompletedAt",
        );

        expect(
          serialized,
        ).not.toContain(
          "accountStatus",
        );

        expect(
          serialized,
        ).not.toContain(
          "introVideo",
        );

        expect(
          serialized,
        ).not.toContain(
          "email",
        );
      },
    );

    test(
      "preserves projection keyset order even when the profile fetch returns rows in another order",
      async () => {
        mocks.prisma
          .publicTeacherDiscoveryEligibility
          .findMany
          .mockResolvedValue([
            membership(
              "teacher-a",
            ),

            membership(
              "teacher-b",
            ),

            membership(
              "teacher-c",
            ),
          ]);

        mocks.prisma
          .teacherProfile
          .findMany
          .mockResolvedValue([
            publicTeacherRow(
              "teacher-b",
            ),

            publicTeacherRow(
              "teacher-a",
            ),
          ]);

        mocks
          .getNextBookableAvailabilityForTeachers
          .mockResolvedValue(
            new Map([
              [
                "teacher-a",
                null,
              ],

              [
                "teacher-b",
                null,
              ],
            ]),
          );

        const result =
          await listPublicTeachers(
            {
              limit:
                2,

              cursor:
                "teacher-previous",

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
          "teacher-a",
          "teacher-b",
        ]);

        expect(
          result.nextCursor,
        ).toBe(
          "teacher-b",
        );

        expect(
          mocks
            .getNextBookableAvailabilityForTeachers,
        ).toHaveBeenCalledWith(
          [
            "teacher-a",
            "teacher-b",
          ],
          RANGE,
          {
            now:
              NOW,
          },
        );
      },
    );

    test(
      "keeps candidate, profile, and availability query counts constant as the page grows",
      async () => {
        const rows =
          Array.from(
            {
              length:
                40,
            },
            (
              _,
              index,
            ) =>
              publicTeacherRow(
                `teacher-${String(
                  index,
                ).padStart(
                  2,
                  "0",
                )}`,
              ),
          );

        mocks.prisma
          .publicTeacherDiscoveryEligibility
          .findMany
          .mockResolvedValue(
            rows.map(
              (
                row,
              ) =>
                membership(
                  row.id,
                ),
            ),
          );

        mocks.prisma
          .teacherProfile
          .findMany
          .mockResolvedValue(
            rows,
          );

        mocks
          .getNextBookableAvailabilityForTeachers
          .mockResolvedValue(
            new Map(
              rows.map(
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
                40,

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
          40,
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
            .teacherProfile
            .findMany,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks
            .getNextBookableAvailabilityForTeachers,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );
  },
);
