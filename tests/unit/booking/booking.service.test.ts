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
        findUnique:
          vi.fn(),

        findFirst:
          vi.fn(),

        count:
          vi.fn(),

        create:
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

      teacherProfile: {
        findUnique:
          vi.fn(),
      },

      speakingSession: {
        findUnique:
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
  BookableTeacherNotFoundError,
  BookingIdempotencyConflictError,
  BookingLimitExceededError,
  BookingSelfBookingError,
  BookingSlotUnavailableError,
  BookingStudentNotEligibleError,
} from "@/lib/errors/booking-errors";
import {
  createSpeakingSession,
} from "@/lib/services/booking.service";

const NOW =
  new Date(
    "2026-08-10T08:00:00.000Z",
  );

const START_AT =
  "2026-08-15T05:30:00.000Z";

const END_AT =
  new Date(
    "2026-08-15T05:45:00.000Z",
  );

const INPUT = {
  teacherProfileId:
    "teacher-profile-1",

  startAt:
    START_AT,

  idempotencyKey:
    "booking-request-00000001",
};

const activeStudent = {
  accountStatus:
    "ACTIVE",

  role:
    "STUDENT",
};

const publicTeacher = {
  id:
    "teacher-profile-1",

  userId:
    "teacher-user-1",

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

const createdSession = {
  id:
    "speaking-session-1",

  teacherProfileId:
    "teacher-profile-1",

  studentUserId:
    "student-user-1",

  startAt:
    new Date(
      START_AT,
    ),

  endAt:
    END_AT,

  status:
    "SCHEDULED",

  createdAt:
    new Date(
      "2026-08-10T08:00:01.000Z",
    ),

  updatedAt:
    new Date(
      "2026-08-10T08:00:01.000Z",
    ),
};

beforeEach(() => {
  vi.clearAllMocks();

  mocks.prisma
    .$transaction
    .mockImplementation(
      async (
        work:
          (
            tx:
              typeof mocks.tx,
          ) =>
            Promise<unknown>,
      ) =>
        work(
          mocks.tx,
        ),
    );

  mocks.prisma
    .user
    .findUnique
    .mockResolvedValue(
      activeStudent,
    );

  mocks.prisma
    .teacherProfile
    .findUnique
    .mockResolvedValue({
      userId:
        "teacher-user-1",
    });

  mocks.prisma
    .speakingSession
    .findUnique
    .mockResolvedValue(
      null,
    );

  mocks.tx
    .$executeRaw
    .mockResolvedValue(
      0,
    );

  mocks.tx
    .user
    .findUnique
    .mockResolvedValue(
      activeStudent,
    );

  mocks.tx
    .speakingSession
    .findUnique
    .mockResolvedValue(
      null,
    );

  mocks.tx
    .teacherProfile
    .findUnique
    .mockResolvedValue(
      publicTeacher,
    );

  mocks.tx
    .speakingSession
    .count
    .mockResolvedValue(
      0,
    );

  mocks.tx
    .speakingSession
    .findFirst
    .mockResolvedValue(
      null,
    );

  mocks.tx
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

  mocks.tx
    .teacherAvailabilityException
    .findMany
    .mockResolvedValue(
      [],
    );

  mocks.tx
    .speakingSession
    .create
    .mockResolvedValue(
      createdSession,
    );
});

describe(
  "booking service",
  () => {
    test(
      "creates a valid server-derived 15-minute speaking session",
      async () => {
        const result =
          await createSpeakingSession(
            "student-user-1",
            INPUT,
            {
              now:
                NOW,
            },
          );

        expect(
          result,
        ).toEqual(
          createdSession,
        );

        /*
         * One student scope + one teacher scope.
         */
        expect(
          mocks.tx
            .$executeRaw,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          mocks.tx
            .speakingSession
            .create,
        ).toHaveBeenCalledWith({
          data: {
            teacherProfileId:
              "teacher-profile-1",

            studentUserId:
              "student-user-1",

            startAt:
              new Date(
                START_AT,
              ),

            endAt:
              END_AT,

            bookingIdempotencyKey:
              "booking-request-00000001",
          },

          select:
            expect.any(
              Object,
            ),
        });
      },
    );

    test(
      "returns the original session for an exact idempotent retry",
      async () => {
        mocks.tx
          .speakingSession
          .findUnique
          .mockResolvedValue(
            createdSession,
          );

        const result =
          await createSpeakingSession(
            "student-user-1",
            INPUT,
            {
              now:
                NOW,
            },
          );

        expect(
          result,
        ).toEqual(
          createdSession,
        );

        expect(
          mocks.tx
            .teacherProfile
            .findUnique,
        ).not.toHaveBeenCalled();

        expect(
          mocks.tx
            .speakingSession
            .create,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "preserves idempotency even when the original slot is now outside policy",
      async () => {
        mocks.tx
          .speakingSession
          .findUnique
          .mockResolvedValue(
            createdSession,
          );

        const result =
          await createSpeakingSession(
            "student-user-1",
            INPUT,
            {
              now:
                new Date(
                  "2026-09-01T08:00:00.000Z",
                ),
            },
          );

        expect(
          result,
        ).toEqual(
          createdSession,
        );
      },
    );

    test(
      "rejects idempotency-key reuse with a different payload",
      async () => {
        mocks.tx
          .speakingSession
          .findUnique
          .mockResolvedValue({
            ...createdSession,

            teacherProfileId:
              "different-teacher-profile",
          });

        await expect(
          createSpeakingSession(
            "student-user-1",
            INPUT,
            {
              now:
                NOW,
            },
          ),
        ).rejects.toBeInstanceOf(
          BookingIdempotencyConflictError,
        );

        expect(
          mocks.tx
            .speakingSession
            .create,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects an ineligible student before opening the transaction",
      async () => {
        mocks.prisma
          .user
          .findUnique
          .mockResolvedValue({
            accountStatus:
              "SUSPENDED",

            role:
              "STUDENT",
          });

        await expect(
          createSpeakingSession(
            "student-user-1",
            INPUT,
            {
              now:
                NOW,
            },
          ),
        ).rejects.toBeInstanceOf(
          BookingStudentNotEligibleError,
        );

        expect(
          mocks.prisma
            .$transaction,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rechecks student eligibility inside the transaction",
      async () => {
        mocks.tx
          .user
          .findUnique
          .mockResolvedValue({
            accountStatus:
              "DISABLED",

            role:
              "STUDENT",
          });

        await expect(
          createSpeakingSession(
            "student-user-1",
            INPUT,
            {
              now:
                NOW,
            },
          ),
        ).rejects.toBeInstanceOf(
          BookingStudentNotEligibleError,
        );

        expect(
          mocks.tx
            .speakingSession
            .create,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "fails closed when teacher eligibility changes before booking",
      async () => {
        mocks.tx
          .teacherProfile
          .findUnique
          .mockResolvedValue({
            ...publicTeacher,

            applicationStatus:
              "SUSPENDED",
          });

        await expect(
          createSpeakingSession(
            "student-user-1",
            INPUT,
            {
              now:
                NOW,
            },
          ),
        ).rejects.toBeInstanceOf(
          BookableTeacherNotFoundError,
        );

        expect(
          mocks.tx
            .speakingSession
            .create,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects self-booking",
      async () => {
        mocks.prisma
          .teacherProfile
          .findUnique
          .mockResolvedValue({
            userId:
              "student-user-1",
          });

        mocks.tx
          .teacherProfile
          .findUnique
          .mockResolvedValue({
            ...publicTeacher,

            userId:
              "student-user-1",
          });

        await expect(
          createSpeakingSession(
            "student-user-1",
            INPUT,
            {
              now:
                NOW,
            },
          ),
        ).rejects.toBeInstanceOf(
          BookingSelfBookingError,
        );

        expect(
          mocks.tx
            .speakingSession
            .create,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "enforces the maximum upcoming session limit",
      async () => {
        mocks.tx
          .speakingSession
          .count
          .mockResolvedValue(
            10,
          );

        await expect(
          createSpeakingSession(
            "student-user-1",
            INPUT,
            {
              now:
                NOW,
            },
          ),
        ).rejects.toBeInstanceOf(
          BookingLimitExceededError,
        );

        expect(
          mocks.tx
            .speakingSession
            .create,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects a requested slot removed from teacher availability",
      async () => {
        mocks.tx
          .teacherAvailabilityRule
          .findMany
          .mockResolvedValue(
            [],
          );

        await expect(
          createSpeakingSession(
            "student-user-1",
            INPUT,
            {
              now:
                NOW,
            },
          ),
        ).rejects.toBeInstanceOf(
          BookingSlotUnavailableError,
        );

        expect(
          mocks.tx
            .speakingSession
            .create,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects an occupied teacher slot",
      async () => {
        /*
         * First findFirst = student occupancy.
         * Second findFirst = teacher occupancy.
         */
        mocks.tx
          .speakingSession
          .findFirst
          .mockResolvedValueOnce(
            null,
          )
          .mockResolvedValueOnce({
            startAt:
              new Date(
                START_AT,
              ),
          });

        await expect(
          createSpeakingSession(
            "student-user-1",
            INPUT,
            {
              now:
                NOW,
            },
          ),
        ).rejects.toBeInstanceOf(
          BookingSlotUnavailableError,
        );
      },
    );

    test(
      "rejects a student collision at the requested start time",
      async () => {
        mocks.tx
          .speakingSession
          .findFirst
          .mockResolvedValueOnce({
            id:
              "other-session",
          });

        await expect(
          createSpeakingSession(
            "student-user-1",
            INPUT,
            {
              now:
                NOW,
            },
          ),
        ).rejects.toBeInstanceOf(
          BookingSlotUnavailableError,
        );

        expect(
          mocks.tx
            .teacherAvailabilityRule
            .findMany,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects a new request outside the booking policy window",
      async () => {
        await expect(
          createSpeakingSession(
            "student-user-1",
            INPUT,
            {
              now:
                new Date(
                  "2026-08-15T05:15:01.000Z",
                ),
            },
          ),
        ).rejects.toBeInstanceOf(
          BookingSlotUnavailableError,
        );

        expect(
          mocks.tx
            .speakingSession
            .create,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
