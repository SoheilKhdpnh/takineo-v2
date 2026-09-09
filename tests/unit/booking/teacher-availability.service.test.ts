import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const mocks =
  vi.hoisted(() => {
    const tx = {
      $executeRaw:
        vi.fn(),

      user: {
        findUnique:
          vi.fn(),
      },

      teacherAvailabilityRule: {
        deleteMany:
          vi.fn(),

        createMany:
          vi.fn(),

        findMany:
          vi.fn(),
      },

      teacherAvailabilityException: {
        create:
          vi.fn(),

        deleteMany:
          vi.fn(),
      },
    };

    const prisma = {
      $transaction:
        vi.fn(),

      user: {
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
    };

    return {
      prisma,
      tx,
    };
  });

vi.mock(
  "@/lib/db/prisma",
  () => ({
    prisma:
      mocks.prisma,
  }),
);

import {
  TeacherAvailabilityExceptionNotFoundError,
  TeacherAvailabilityRangeError,
  TeacherAvailabilityStateError,
} from "@/lib/errors/teacher-availability-errors";
import {
  createTeacherAvailabilityException,
  deleteTeacherAvailabilityException,
  getTeacherAvailabilityForUser,
  replaceTeacherWeeklyAvailability,
} from "@/lib/services/teacher-availability.service";

const approvedTeacher = {
  accountStatus:
    "ACTIVE",
  role:
    "TEACHER",

  teacherProfile: {
    id:
      "teacher-profile-1",

    applicationStatus:
      "APPROVED",
  },
};

beforeEach(() => {
  vi.clearAllMocks();

  mocks.prisma
    .$transaction
    .mockImplementation(
      async (
        work:
          (tx: typeof mocks.tx) =>
            Promise<unknown>,
      ) =>
        work(
          mocks.tx,
        ),
    );

  mocks.tx
    .$executeRaw
    .mockResolvedValue([
      {
        pg_advisory_xact_lock:
          null,
      },
    ]);

  mocks.tx
    .user
    .findUnique
    .mockResolvedValue(
      approvedTeacher,
    );

  mocks.prisma
    .user
    .findUnique
    .mockResolvedValue(
      approvedTeacher,
    );

  mocks.tx
    .teacherAvailabilityRule
    .deleteMany
    .mockResolvedValue({
      count: 0,
    });

  mocks.tx
    .teacherAvailabilityRule
    .createMany
    .mockResolvedValue({
      count: 1,
    });

  mocks.tx
    .teacherAvailabilityRule
    .findMany
    .mockResolvedValue([]);

  mocks.prisma
    .teacherAvailabilityRule
    .findMany
    .mockResolvedValue([]);

  mocks.prisma
    .teacherAvailabilityException
    .findMany
    .mockResolvedValue([]);
});

describe(
  "teacher availability service",
  () => {
    test(
      "atomically replaces an approved teacher weekly schedule",
      async () => {
        mocks.tx
          .teacherAvailabilityRule
          .findMany
          .mockResolvedValue([
            {
              id:
                "rule-1",

              teacherProfileId:
                "teacher-profile-1",

              weekday:
                "SATURDAY",

              startMinute:
                540,

              endMinute:
                600,

              isActive:
                true,

              createdAt:
                new Date(),

              updatedAt:
                new Date(),
            },
          ]);

        const result =
          await replaceTeacherWeeklyAvailability(
            "teacher-user-1",
            {
              rules: [
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
              ],
            },
          );

        expect(
          mocks.prisma
            .$transaction,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks.tx
            .$executeRaw,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks.tx
            .teacherAvailabilityRule
            .deleteMany,
        ).toHaveBeenCalledWith({
          where: {
            teacherProfileId:
              "teacher-profile-1",
          },
        });

        expect(
          mocks.tx
            .teacherAvailabilityRule
            .createMany,
        ).toHaveBeenCalledWith({
          data: [
            {
              teacherProfileId:
                "teacher-profile-1",

              weekday:
                "SATURDAY",

              startMinute:
                540,

              endMinute:
                600,

              isActive:
                true,
            },
          ],
        });

        expect(
          result,
        ).toHaveLength(
          1,
        );
      },
    );

    test(
      "rejects availability writes for a teacher that is no longer approved",
      async () => {
        mocks.tx
          .user
          .findUnique
          .mockResolvedValue({
            ...approvedTeacher,

            teacherProfile: {
              id:
                "teacher-profile-1",

              applicationStatus:
                "SUSPENDED",
            },
          });

        await expect(
          replaceTeacherWeeklyAvailability(
            "teacher-user-1",
            {
              rules: [],
            },
          ),
        ).rejects.toBeInstanceOf(
          TeacherAvailabilityStateError,
        );

        expect(
          mocks.tx
            .teacherAvailabilityRule
            .deleteMany,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "allows an approved teacher to clear all weekly availability",
      async () => {
        await replaceTeacherWeeklyAvailability(
          "teacher-user-1",
          {
            rules: [],
          },
        );

        expect(
          mocks.tx
            .teacherAvailabilityRule
            .deleteMany,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks.tx
            .teacherAvailabilityRule
            .createMany,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "creates a date-specific exception scoped to the authenticated teacher",
      async () => {
        mocks.tx
          .teacherAvailabilityException
          .create
          .mockResolvedValue({
            id:
              "exception-1",

            teacherProfileId:
              "teacher-profile-1",

            date:
              new Date(
                "2026-08-15T00:00:00.000Z",
              ),

            startMinute:
              540,

            endMinute:
              600,

            type:
              "UNAVAILABLE",

            note:
              "Appointment",

            createdAt:
              new Date(),

            updatedAt:
              new Date(),
          });

        const result =
          await createTeacherAvailabilityException(
            "teacher-user-1",
            {
              date:
                "2026-08-15",

              startMinute:
                540,

              endMinute:
                600,

              type:
                "UNAVAILABLE",

              note:
                "Appointment",
            },
          );

        expect(
          result.date,
        ).toBe(
          "2026-08-15",
        );

        expect(
          mocks.tx
            .teacherAvailabilityException
            .create,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data:
              expect.objectContaining({
                teacherProfileId:
                  "teacher-profile-1",

                startMinute:
                  540,

                endMinute:
                  600,

                type:
                  "UNAVAILABLE",
              }),
          }),
        );
      },
    );

    test(
      "cannot delete another or missing teacher exception",
      async () => {
        mocks.tx
          .teacherAvailabilityException
          .deleteMany
          .mockResolvedValue({
            count: 0,
          });

        await expect(
          deleteTeacherAvailabilityException(
            "teacher-user-1",
            "missing-exception",
          ),
        ).rejects.toBeInstanceOf(
          TeacherAvailabilityExceptionNotFoundError,
        );
      },
    );

    test(
      "returns weekly rules and only exceptions inside a bounded read range",
      async () => {
        mocks.prisma
          .teacherAvailabilityRule
          .findMany
          .mockResolvedValue([
            {
              id:
                "rule-1",

              teacherProfileId:
                "teacher-profile-1",

              weekday:
                "SATURDAY",

              startMinute:
                540,

              endMinute:
                600,

              isActive:
                true,

              createdAt:
                new Date(),

              updatedAt:
                new Date(),
            },
          ]);

        mocks.prisma
          .teacherAvailabilityException
          .findMany
          .mockResolvedValue([
            {
              id:
                "exception-1",

              teacherProfileId:
                "teacher-profile-1",

              date:
                new Date(
                  "2026-08-15T00:00:00.000Z",
                ),

              startMinute:
                540,

              endMinute:
                600,

              type:
                "UNAVAILABLE",

              note:
                null,

              createdAt:
                new Date(),

              updatedAt:
                new Date(),
            },
          ]);

        const result =
          await getTeacherAvailabilityForUser(
            "teacher-user-1",
            {
              fromDate:
                "2026-08-10",

              toDate:
                "2026-08-20",
            },
          );

        expect(
          result.rules,
        ).toHaveLength(
          1,
        );

        expect(
          result.exceptions[
            0
          ]?.date,
        ).toBe(
          "2026-08-15",
        );

        expect(
          mocks.prisma
            .teacherAvailabilityException
            .findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining({
                teacherProfileId:
                  "teacher-profile-1",

                date: {
                  gte:
                    new Date(
                      "2026-08-10T00:00:00.000Z",
                    ),

                  lte:
                    new Date(
                      "2026-08-20T00:00:00.000Z",
                    ),
                },
              }),
          }),
        );
      },
    );

    test(
      "rejects reversed availability read ranges",
      async () => {
        await expect(
          getTeacherAvailabilityForUser(
            "teacher-user-1",
            {
              fromDate:
                "2026-08-20",

              toDate:
                "2026-08-10",
            },
          ),
        ).rejects.toMatchObject({
          name:
            "TeacherAvailabilityRangeError",

          reason:
            "INVALID_DATE_RANGE",
        });
      },
    );

    test(
      "rejects excessively large availability read ranges",
      async () => {
        await expect(
          getTeacherAvailabilityForUser(
            "teacher-user-1",
            {
              fromDate:
                "2026-08-01",

              toDate:
                "2026-09-15",
            },
          ),
        ).rejects.toBeInstanceOf(
          TeacherAvailabilityRangeError,
        );

        expect(
          mocks.prisma
            .user
            .findUnique,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
