import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),

    user: {
      findUnique: vi.fn(),
    },

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
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  };

  const prisma = {
    $transaction: vi.fn(),

    user: {
      findUnique: vi.fn(),
    },

    teacherProfile: {
      findUnique: vi.fn(),
    },

    speakingSession: {
      findUnique: vi.fn(),
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
    prisma: mocks.prisma,
  }),
);

import {
  BookableTeacherNotFoundError,
} from "@/lib/errors/booking-errors";
import {
  createSpeakingSession,
} from "@/lib/services/booking.service";

const NOW =
  new Date(
    "2026-08-10T08:00:00.000Z",
  );

const staleDiscoverySnapshot = {
  teacherProfileId:
    "teacher-profile-1",

  startAt:
    "2026-08-15T05:30:00.000Z",
} as const;

const bookingInput = {
  ...staleDiscoverySnapshot,

  idempotencyKey:
    "track-d-stale-eligibility-0001",
};

const activeStudent = {
  accountStatus:
    "ACTIVE",

  role:
    "STUDENT",
};

const publiclyEligibleTeacherAtDiscoveryTime = {
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

describe(
  "Track D stale discovery -> booking eligibility attack",
  () => {
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

      /*
       * These preflight reads intentionally model a stale/advisory
       * discovery result. They are not the authority for booking.
       */
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
            publiclyEligibleTeacherAtDiscoveryTime.userId,
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
        .mockResolvedValue(
          [],
        );

      mocks.tx
        .teacherAvailabilityException
        .findMany
        .mockResolvedValue(
          [],
        );
    });

    it(
      "rejects a stale discovery result when the teacher is no longer public/bookable at authoritative booking time",
      async () => {
        /*
         * Between discovery and booking the teacher stops being
         * publicly eligible. The stale discovery snapshot still
         * carries a valid-looking teacherProfileId/startAt pair.
         */
        mocks.tx
          .teacherProfile
          .findUnique
          .mockResolvedValue({
            ...publiclyEligibleTeacherAtDiscoveryTime,

            applicationStatus:
              "SUSPENDED",
          });

        await expect(
          createSpeakingSession(
            "student-user-1",
            bookingInput,
            {
              now:
                NOW,
            },
          ),
        ).rejects.toBeInstanceOf(
          BookableTeacherNotFoundError,
        );

        /*
         * The critical evidence: booking consulted current state
         * inside its transaction and never inserted from stale
         * discovery data.
         */
        expect(
          mocks.tx
            .teacherProfile
            .findUnique,
        ).toHaveBeenCalled();

        expect(
          mocks.tx
            .speakingSession
            .create,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
