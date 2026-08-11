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
  BookableSlotsRangeError,
  BookableTeacherNotFoundError,
} from "@/lib/errors/booking-errors";
import {
  getBookableSlotsForTeacher,
} from "@/lib/services/bookable-slots.service";

const publicTeacher = {
  id:
    "teacher-profile-1",

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
};

beforeEach(() => {
  vi.clearAllMocks();

  mocks.prisma
    .teacherProfile
    .findUnique
    .mockResolvedValue(
      publicTeacher,
    );

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
  "bookable slots service",
  () => {
    test(
      "projects public teacher recurring availability from the database",
      async () => {
        mocks.prisma
          .teacherAvailabilityRule
          .findMany
          .mockResolvedValue([
            {
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

        expect(
          result.timezone,
        ).toBe(
          "Asia/Tehran",
        );

        expect(
          result.slots.map(
            (slot) =>
              slot.startMinute,
          ),
        ).toEqual([
          540,
          555,
          570,
          585,
        ]);

        expect(
          mocks.prisma
            .speakingSession
            .findMany,
        ).toHaveBeenCalledWith({
          where: {
            teacherProfileId:
              "teacher-profile-1",

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
                  "2026-08-15T20:30:00.000Z",
                ),
            },
          },

          select: {
            startAt: true,
          },
        });
      },
    );

    test(
      "subtracts unavailable exceptions and occupied sessions",
      async () => {
        mocks.prisma
          .teacherAvailabilityRule
          .findMany
          .mockResolvedValue([
            {
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
              date:
                new Date(
                  "2026-08-15T00:00:00.000Z",
                ),

              startMinute:
                555,

              endMinute:
                585,

              type:
                "UNAVAILABLE",
            },
          ]);

        mocks.prisma
          .speakingSession
          .findMany
          .mockResolvedValue([
            {
              startAt:
                new Date(
                  "2026-08-15T06:15:00.000Z",
                ),
            },
          ]);

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

        expect(
          result.slots.map(
            (slot) =>
              slot.startMinute,
          ),
        ).toEqual([
          540,
        ]);
      },
    );

    test(
      "AVAILABLE exceptions can create bookable time without a recurring rule",
      async () => {
        mocks.prisma
          .teacherAvailabilityException
          .findMany
          .mockResolvedValue([
            {
              date:
                new Date(
                  "2026-08-15T00:00:00.000Z",
                ),

              startMinute:
                660,

              endMinute:
                705,

              type:
                "AVAILABLE",
            },
          ]);

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

        expect(
          result.slots.map(
            (slot) =>
              slot.startMinute,
          ),
        ).toEqual([
          660,
          675,
          690,
        ]);
      },
    );

    test(
      "fails closed when the teacher application is not approved",
      async () => {
        mocks.prisma
          .teacherProfile
          .findUnique
          .mockResolvedValue({
            ...publicTeacher,

            applicationStatus:
              "PENDING_REVIEW",
          });

        await expect(
          getBookableSlotsForTeacher(
            "teacher-profile-1",
            {
              fromDate:
                "2026-08-15",

              toDate:
                "2026-08-15",
            },
          ),
        ).rejects.toBeInstanceOf(
          BookableTeacherNotFoundError,
        );

        expect(
          mocks.prisma
            .teacherAvailabilityRule
            .findMany,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "fails closed for an inactive teacher account",
      async () => {
        mocks.prisma
          .teacherProfile
          .findUnique
          .mockResolvedValue({
            ...publicTeacher,

            user: {
              accountStatus:
                "SUSPENDED",
            },
          });

        await expect(
          getBookableSlotsForTeacher(
            "teacher-profile-1",
            {
              fromDate:
                "2026-08-15",

              toDate:
                "2026-08-15",
            },
          ),
        ).rejects.toBeInstanceOf(
          BookableTeacherNotFoundError,
        );
      },
    );

    test(
      "fails closed when the intro video is not publicly approved",
      async () => {
        mocks.prisma
          .teacherProfile
          .findUnique
          .mockResolvedValue({
            ...publicTeacher,

            introVideo: {
              status:
                "READY_FOR_REVIEW",
            },
          });

        await expect(
          getBookableSlotsForTeacher(
            "teacher-profile-1",
            {
              fromDate:
                "2026-08-15",

              toDate:
                "2026-08-15",
            },
          ),
        ).rejects.toBeInstanceOf(
          BookableTeacherNotFoundError,
        );
      },
    );

    test(
      "rejects reversed ranges before querying the database",
      async () => {
        await expect(
          getBookableSlotsForTeacher(
            "teacher-profile-1",
            {
              fromDate:
                "2026-08-20",

              toDate:
                "2026-08-15",
            },
          ),
        ).rejects.toMatchObject({
          name:
            "BookableSlotsRangeError",

          reason:
            "INVALID_DATE_RANGE",
        });

        expect(
          mocks.prisma
            .teacherProfile
            .findUnique,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects oversized discovery ranges before querying the database",
      async () => {
        await expect(
          getBookableSlotsForTeacher(
            "teacher-profile-1",
            {
              fromDate:
                "2026-08-01",

              toDate:
                "2026-09-15",
            },
          ),
        ).rejects.toBeInstanceOf(
          BookableSlotsRangeError,
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
