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
        findUnique:
          vi.fn(),
      },

      teacherAvailabilityRule: {
        findMany:
          vi.fn(),
      },

      teacherAvailabilityException: {
        findMany:
          vi.fn(),
      },

      speakingSession: {
        findMany:
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
  getNextBookableAvailabilityForTeachers,
} from "@/lib/services/bookable-slots.service";

const NOW =
  new Date(
    "2026-08-10T08:00:00.000Z",
  );

const RANGE = {
  fromDate:
    "2026-08-15",

  toDate:
    "2026-08-16",
};

beforeEach(() => {
  vi.clearAllMocks();

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

describe(
  "batch bookable next availability",
  () => {
    test(
      "returns an empty map without querying when there are no candidate teachers",
      async () => {
        const result =
          await getNextBookableAvailabilityForTeachers(
            [],
            RANGE,
            {
              now:
                NOW,
            },
          );

        expect(
          [...result.entries()],
        ).toEqual([]);

        expect(
          mocks.prisma
            .teacherAvailabilityRule
            .findMany,
        ).not.toHaveBeenCalled();

        expect(
          mocks.prisma
            .teacherAvailabilityException
            .findMany,
        ).not.toHaveBeenCalled();

        expect(
          mocks.prisma
            .speakingSession
            .findMany,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "computes next availability for multiple teachers from three batched reads",
      async () => {
        mocks.prisma
          .teacherAvailabilityRule
          .findMany
          .mockResolvedValue([
            {
              teacherProfileId:
                "teacher-a",

              weekday:
                "SATURDAY",

              startMinute:
                540,

              endMinute:
                600,

              isActive:
                true,
            },
          ]);

        mocks.prisma
          .teacherAvailabilityException
          .findMany
          .mockResolvedValue([
            {
              teacherProfileId:
                "teacher-a",

              date:
                new Date(
                  "2026-08-15T00:00:00.000Z",
                ),

              startMinute:
                555,

              endMinute:
                570,

              type:
                "UNAVAILABLE",
            },

            {
              teacherProfileId:
                "teacher-b",

              date:
                new Date(
                  "2026-08-15T00:00:00.000Z",
                ),

              startMinute:
                780,

              endMinute:
                795,

              type:
                "AVAILABLE",
            },
          ]);

        mocks.prisma
          .speakingSession
          .findMany
          .mockResolvedValue([
            {
              teacherProfileId:
                "teacher-a",

              startAt:
                new Date(
                  "2026-08-15T05:30:00.000Z",
                ),
            },
          ]);

        const result =
          await getNextBookableAvailabilityForTeachers(
            [
              "teacher-a",
              "teacher-b",
              "teacher-c",
            ],
            RANGE,
            {
              now:
                NOW,
            },
          );

        expect(
          result.get(
            "teacher-a",
          ),
        ).toEqual(
          new Date(
            "2026-08-15T06:00:00.000Z",
          ),
        );

        expect(
          result.get(
            "teacher-b",
          ),
        ).toEqual(
          new Date(
            "2026-08-15T09:30:00.000Z",
          ),
        );

        expect(
          result.get(
            "teacher-c",
          ),
        ).toBeNull();

        expect(
          mocks.prisma
            .teacherAvailabilityRule
            .findMany,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks.prisma
            .teacherAvailabilityException
            .findMany,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks.prisma
            .speakingSession
            .findMany,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    test(
      "uses one query per availability table even for a large teacher page",
      async () => {
        const teacherProfileIds =
          Array.from(
            {
              length:
                40,
            },
            (
              _,
              index,
            ) =>
              `teacher-${String(
                index,
              ).padStart(
                2,
                "0",
              )}`,
          );

        const result =
          await getNextBookableAvailabilityForTeachers(
            teacherProfileIds,
            RANGE,
            {
              now:
                NOW,
            },
          );

        expect(
          result.size,
        ).toBe(
          40,
        );

        for (
          const teacherProfileId
          of teacherProfileIds
        ) {
          expect(
            result.get(
              teacherProfileId,
            ),
          ).toBeNull();
        }

        expect(
          mocks.prisma
            .teacherAvailabilityRule
            .findMany,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks.prisma
            .teacherAvailabilityException
            .findMany,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks.prisma
            .speakingSession
            .findMany,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks.prisma
            .teacherAvailabilityRule
            .findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining({
                teacherProfileId: {
                  in:
                    teacherProfileIds,
                },

                isActive:
                  true,
              }),
          }),
        );
      },
    );

    test(
      "deduplicates candidate IDs before database access",
      async () => {
        const result =
          await getNextBookableAvailabilityForTeachers(
            [
              "teacher-a",
              "teacher-a",
              "teacher-b",
              "teacher-b",
            ],
            RANGE,
            {
              now:
                NOW,
            },
          );

        expect(
          [...result.keys()],
        ).toEqual([
          "teacher-a",
          "teacher-b",
        ]);

        expect(
          mocks.prisma
            .teacherAvailabilityRule
            .findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining({
                teacherProfileId: {
                  in: [
                    "teacher-a",
                    "teacher-b",
                  ],
                },
              }),
          }),
        );
      },
    );

    test(
      "queries only non-cancelled sessions inside the Tehran date window",
      async () => {
        await getNextBookableAvailabilityForTeachers(
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
            .speakingSession
            .findMany,
        ).toHaveBeenCalledWith({
          where: {
            teacherProfileId: {
              in: [
                "teacher-a",
                "teacher-b",
              ],
            },

            status: {
              not:
                "CANCELLED",
            },

            startAt: {
              gte:
                new Date(
                  "2026-08-14T20:30:00.000Z",
                ),

              lt:
                new Date(
                  "2026-08-16T20:30:00.000Z",
                ),
            },
          },

          select: {
            teacherProfileId:
              true,

            startAt:
              true,
          },
        });
      },
    );
  },
);
