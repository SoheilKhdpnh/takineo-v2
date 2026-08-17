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
  id: string,
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

    applicationStatus:
      "APPROVED",

    profileCompletedAt:
      new Date(
        "2026-08-01T00:00:00.000Z",
      ),

    /*
     * These fields are intentionally injected into the mock
     * even though a correct Prisma select must never request them.
     * Explicit DTO mapping must prevent them from leaking.
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

      accountStatus:
        "ACTIVE",

      email:
        `${id}@private.example.test`,
    },

    introVideo: {
      status:
        "APPROVED",

      rejectionReason:
        "PRIVATE REJECTION",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.prisma
    .teacherProfile
    .findMany
    .mockResolvedValue([]);

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
      "validates the booking date range before querying even when discovery is empty",
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
          mocks
            .validateBookableSlotsRange,
        ).toHaveBeenCalledWith({
          fromDate:
            "2026-08-23",

          toDate:
            "2026-08-17",
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
      "returns an explicit privacy-safe public DTO and attaches batched next availability",
      async () => {
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
            "teacher-a",
          ],
          RANGE,
          {
            now:
              NOW,
          },
        );

        const query =
          mocks.prisma
            .teacherProfile
            .findMany
            .mock
            .calls[0]?.[0];

        expect(
          query,
        ).toBeDefined();

        expect(
          query.select,
        ).not.toHaveProperty(
          "applicationReviewNote",
        );

        expect(
          query.select,
        ).not.toHaveProperty(
          "applicationSubmittedAt",
        );

        expect(
          query.select,
        ).not.toHaveProperty(
          "applicationReviewedAt",
        );

        expect(
          query.select,
        ).not.toHaveProperty(
          "reviewCycle",
        );

        expect(
          query.select,
        ).not.toHaveProperty(
          "submittedVideoAssetId",
        );

        expect(
          query.select.user.select,
        ).not.toHaveProperty(
          "email",
        );

        expect(
          query.select.introVideo.select,
        ).not.toHaveProperty(
          "rejectionReason",
        );
      },
    );

    test(
      "queries only bookable public teachers in stable id order",
      async () => {
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
            where:
              expect.objectContaining({
                applicationStatus:
                  "APPROVED",

                profileCompletedAt: {
                  not:
                    null,
                },
              }),

            orderBy: {
              id:
                "asc",
            },

            take:
              21,
          }),
        );

        const query =
          mocks.prisma
            .teacherProfile
            .findMany
            .mock
            .calls[0]?.[0];

        expect(
          JSON.stringify(
            query.where,
          ),
        ).toContain(
          '"accountStatus":"ACTIVE"',
        );

        expect(
          JSON.stringify(
            query.where,
          ),
        ).toContain(
          '"status":"APPROVED"',
        );
      },
    );

    test(
      "uses id keyset pagination and excludes the lookahead row from availability projection",
      async () => {
        mocks.prisma
          .teacherProfile
          .findMany
          .mockResolvedValue([
            publicTeacherRow(
              "teacher-a",
            ),

            publicTeacherRow(
              "teacher-b",
            ),

            publicTeacherRow(
              "teacher-c",
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

        expect(
          mocks.prisma
            .teacherProfile
            .findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining({
                id: {
                  gt:
                    "teacher-previous",
                },
              }),

            orderBy: {
              id:
                "asc",
            },

            take:
              3,
          }),
        );
      },
    );

    test(
      "does not run availability projection when the discovery page is empty",
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
          mocks
            .getNextBookableAvailabilityForTeachers,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "keeps discovery query count constant as the page grows",
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
