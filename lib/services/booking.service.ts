import "server-only";

import {
  prisma,
} from "@/lib/db/prisma";
import {
  parseBookingDateKey,
} from "@/lib/domain/booking";
import {
  BOOKING_MAX_UPCOMING_SESSIONS_PER_STUDENT,
  BOOKING_SESSION_MINUTES,
} from "@/lib/domain/booking-policy";
import {
  isPublicTeacher,
} from "@/lib/domain/teacher-application";
import {
  BookableTeacherNotFoundError,
  BookingConflictError,
  BookingIdempotencyConflictError,
  BookingLimitExceededError,
  BookingSelfBookingError,
  BookingSlotUnavailableError,
  BookingStudentNotEligibleError,
} from "@/lib/errors/booking-errors";
import {
  Prisma,
} from "@/lib/generated/prisma/client";
import {
  projectAvailabilityForDate,
} from "@/lib/services/availability-projection.service";
import {
  lockStudentAndTeacherBookingScopes,
} from "@/lib/services/booking-locks";
import {
  runSerializableTransaction,
} from "@/lib/services/serializable-transaction";
import {
  getBookingWindow,
  instantToIranDateKey,
} from "@/lib/time/iran-booking-time";
import {
  createSpeakingSessionSchema,
  type CreateSpeakingSessionInput,
} from "@/lib/validations/booking";

const speakingSessionSelect = {
  id: true,
  teacherProfileId: true,
  studentUserId: true,
  startAt: true,
  endAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies
  Prisma.SpeakingSessionSelect;

export type SpeakingSessionRecord =
  Prisma.SpeakingSessionGetPayload<{
    select:
      typeof speakingSessionSelect;
  }>;

function toDatabaseDate(
  dateKey: string,
): Date {
  const {
    year,
    month,
    day,
  } =
    parseBookingDateKey(
      dateKey,
    );

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
    ),
  );
}

function assertRequestedStartInsidePolicy(
  startAt: Date,
  now: Date,
): void {
  const {
    earliestStartAt,
    latestStartAt,
  } =
    getBookingWindow(
      now,
    );

  if (
    startAt <
      earliestStartAt ||
    startAt >
      latestStartAt
  ) {
    throw new BookingSlotUnavailableError();
  }
}

function isSameIdempotentRequest(
  existing:
    SpeakingSessionRecord,
  teacherProfileId: string,
  startAt: Date,
): boolean {
  return (
    existing.teacherProfileId ===
      teacherProfileId &&
    existing.startAt.getTime() ===
      startAt.getTime()
  );
}

function isBookingDomainError(
  error: unknown,
): boolean {
  return (
    error instanceof
      BookableTeacherNotFoundError ||
    error instanceof
      BookingStudentNotEligibleError ||
    error instanceof
      BookingSelfBookingError ||
    error instanceof
      BookingSlotUnavailableError ||
    error instanceof
      BookingLimitExceededError ||
    error instanceof
      BookingIdempotencyConflictError ||
    error instanceof
      BookingConflictError
  );
}

async function getBookingTeacherIdentity(
  teacherProfileId: string,
): Promise<{
  teacherUserId: string;
}> {
  const teacher =
    await prisma
      .teacherProfile
      .findUnique({
        where: {
          id:
            teacherProfileId,
        },

        select: {
          userId: true,
        },
      });

  if (!teacher) {
    throw new BookableTeacherNotFoundError();
  }

  return {
    teacherUserId:
      teacher.userId,
  };
}

async function resolveUniqueCollision(
  studentUserId: string,
  input: {
    teacherProfileId: string;
    idempotencyKey: string;
  },
  startAt: Date,
): Promise<SpeakingSessionRecord> {
  /*
   * P2002 can represent several independent
   * database race barriers:
   *
   * - same student's idempotency key
   * - teacher's active slot
   * - student's active slot
   *
   * First determine whether the collision was
   * actually an idempotent retry.
   */
  const existing =
    await prisma
      .speakingSession
      .findUnique({
        where: {
          studentUserId_bookingIdempotencyKey: {
            studentUserId,

            bookingIdempotencyKey:
              input.idempotencyKey,
          },
        },

        select:
          speakingSessionSelect,
      });

  if (existing) {
    if (
      isSameIdempotentRequest(
        existing,
        input.teacherProfileId,
        startAt,
      )
    ) {
      return existing;
    }

    throw new BookingIdempotencyConflictError();
  }

  /*
   * No session owns this idempotency key, so
   * the unique collision came from slot
   * ownership instead.
   */
  throw new BookingSlotUnavailableError();
}

export async function createSpeakingSession(
  studentUserId: string,
  input:
    CreateSpeakingSessionInput,
  options: {
    now?: Date;
  } = {},
): Promise<SpeakingSessionRecord> {
  const parsed =
    createSpeakingSessionSchema.parse(
      input,
    );

  const startAt =
    new Date(
      parsed.startAt,
    );

  const now =
    options.now ??
    new Date();

  /*
   * These are preflight reads only.
   *
   * Every security- and booking-critical
   * condition is checked again inside the
   * authoritative Serializable transaction.
   */
  const studentPreflight =
    await prisma
      .user
      .findUnique({
        where: {
          id:
            studentUserId,
        },

        select: {
          accountStatus: true,
          role: true,
        },
      });

  if (
    !studentPreflight ||
    studentPreflight.accountStatus !==
      "ACTIVE" ||
    studentPreflight.role !==
      "STUDENT"
  ) {
    throw new BookingStudentNotEligibleError();
  }

  const {
    teacherUserId,
  } =
    await getBookingTeacherIdentity(
      parsed.teacherProfileId,
    );

  try {
    return await runSerializableTransaction(
      async (tx) => {
        /*
         * These must be the first database
         * operations inside the authoritative
         * transaction.
         *
         * Teacher availability writes use the
         * same teacher lock namespace.
         */
        await lockStudentAndTeacherBookingScopes(
          tx,
          {
            studentUserId,
            teacherUserId,
          },
        );

        const student =
          await tx
            .user
            .findUnique({
              where: {
                id:
                  studentUserId,
              },

              select: {
                accountStatus:
                  true,

                role:
                  true,
              },
            });

        if (
          !student ||
          student.accountStatus !==
            "ACTIVE" ||
          student.role !==
            "STUDENT"
        ) {
          throw new BookingStudentNotEligibleError();
        }

        /*
         * Resolve idempotency before applying
         * current teacher/slot policy.
         *
         * If the original request succeeded,
         * a later retry should return that
         * durable session instead of attempting
         * to create another one.
         */
        const existing =
          await tx
            .speakingSession
            .findUnique({
              where: {
                studentUserId_bookingIdempotencyKey: {
                  studentUserId,

                  bookingIdempotencyKey:
                    parsed.idempotencyKey,
                },
              },

              select:
                speakingSessionSelect,
            });

        if (existing) {
          if (
            isSameIdempotentRequest(
              existing,
              parsed.teacherProfileId,
              startAt,
            )
          ) {
            return existing;
          }

          throw new BookingIdempotencyConflictError();
        }

        const teacher =
          await tx
            .teacherProfile
            .findUnique({
              where: {
                id:
                  parsed.teacherProfileId,
              },

              select: {
                id: true,
                userId: true,

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

        /*
         * The profile must still belong to the
         * same user whose lock we acquired.
         */
        if (
          !teacher ||
          teacher.userId !==
            teacherUserId
        ) {
          throw new BookableTeacherNotFoundError();
        }

        if (
          teacher.userId ===
          studentUserId
        ) {
          throw new BookingSelfBookingError();
        }

        if (
          !isPublicTeacher(
            teacher.user.accountStatus,
            teacher.applicationStatus,
            teacher.profileCompletedAt,
            teacher.introVideo
              ?.status ??
              null,
          )
        ) {
          throw new BookableTeacherNotFoundError();
        }

        /*
         * Policy is intentionally evaluated
         * after idempotency.
         *
         * A legitimate old retry can therefore
         * still recover its original durable
         * result even if today's booking window
         * has moved.
         */
        assertRequestedStartInsidePolicy(
          startAt,
          now,
        );

        const upcomingCount =
          await tx
            .speakingSession
            .count({
              where: {
                studentUserId,

                status:
                  "SCHEDULED",

                startAt: {
                  gte:
                    now,
                },
              },
            });

        if (
          upcomingCount >=
          BOOKING_MAX_UPCOMING_SESSIONS_PER_STUDENT
        ) {
          throw new BookingLimitExceededError();
        }

        const dateKey =
          instantToIranDateKey(
            startAt,
          );

        const databaseDate =
          toDatabaseDate(
            dateKey,
          );

        /*
         * Student and teacher slot occupancy are
         * checked explicitly for good domain
         * errors. PostgreSQL remains the final
         * race barrier.
         */
        const studentOccupancy =
          await tx
            .speakingSession
            .findFirst({
              where: {
                studentUserId,

                startAt,

                status: {
                  not:
                    "CANCELLED",
                },
              },

              select: {
                id: true,
              },
            });

        if (
          studentOccupancy
        ) {
          throw new BookingSlotUnavailableError();
        }

        const teacherOccupancy =
          await tx
            .speakingSession
            .findFirst({
              where: {
                teacherProfileId:
                  teacher.id,

                startAt,

                status: {
                  not:
                    "CANCELLED",
                },
              },

              select: {
                startAt: true,
              },
            });

        const rules =
          await tx
            .teacherAvailabilityRule
            .findMany({
              where: {
                teacherProfileId:
                  teacher.id,
              },

              select: {
                weekday:
                  true,

                startMinute:
                  true,

                endMinute:
                  true,

                isActive:
                  true,
              },
            });

        const exceptions =
          await tx
            .teacherAvailabilityException
            .findMany({
              where: {
                teacherProfileId:
                  teacher.id,

                date:
                  databaseDate,
              },

              select: {
                date:
                  true,

                startMinute:
                  true,

                endMinute:
                  true,

                type:
                  true,
              },
            });

        const projectedSlots =
          projectAvailabilityForDate({
            date:
              dateKey,

            now,

            rules,

            exceptions:
              exceptions.map(
                (
                  exception,
                ) => ({
                  date:
                    exception.date
                      .toISOString()
                      .slice(
                        0,
                        10,
                      ),

                  startMinute:
                    exception
                      .startMinute,

                  endMinute:
                    exception
                      .endMinute,

                  type:
                    exception.type,
                }),
              ),

            occupiedStartTimes:
              teacherOccupancy
                ? [
                    teacherOccupancy
                      .startAt,
                  ]
                : [],
          });

        const requestedSlot =
          projectedSlots.find(
            (slot) =>
              slot.startAt
                .getTime() ===
              startAt.getTime(),
          );

        if (
          !requestedSlot
        ) {
          throw new BookingSlotUnavailableError();
        }

        /*
         * Duration is server-derived.
         *
         * The client never controls endAt.
         */
        const expectedEndAt =
          new Date(
            startAt.getTime() +
              BOOKING_SESSION_MINUTES *
                60_000,
          );

        /*
         * Defensive invariant between the
         * projection engine and booking policy.
         */
        if (
          requestedSlot.endAt
            .getTime() !==
          expectedEndAt.getTime()
        ) {
          throw new BookingConflictError();
        }

        return tx
          .speakingSession
          .create({
            data: {
              teacherProfileId:
                teacher.id,

              studentUserId,

              startAt,

              endAt:
                expectedEndAt,

              bookingIdempotencyKey:
                parsed.idempotencyKey,
            },

            select:
              speakingSessionSelect,
          });
      },
      {
        maxAttempts: 3,

        conflictErrorFactory:
          () =>
            new BookingConflictError(),
      },
    );
  } catch (error) {
    if (
      isBookingDomainError(
        error,
      )
    ) {
      throw error;
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError
    ) {
      if (
        error.code ===
        "P2002"
      ) {
        /*
         * A concurrent identical idempotent
         * request may reach the database unique
         * constraint before our snapshot can
         * observe the winning row.
         *
         * Resolve the committed state outside
         * the failed transaction.
         */
        return resolveUniqueCollision(
          studentUserId,
          {
            teacherProfileId:
              parsed.teacherProfileId,

            idempotencyKey:
              parsed.idempotencyKey,
          },
          startAt,
        );
      }

      if (
        error.code ===
        "P2034"
      ) {
        throw new BookingConflictError();
      }
    }

    /*
     * Do not convert unknown database invariant
     * failures into retryable booking errors.
     *
     * Unexpected constraint failures should
     * remain visible to monitoring and tests.
     */
    throw error;
  }
}
