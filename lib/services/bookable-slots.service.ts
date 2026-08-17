import "server-only";

import {
  prisma,
} from "@/lib/db/prisma";
import {
  parseBookingDateKey,
} from "@/lib/domain/booking";
import {
  BOOKING_MAX_AVAILABILITY_QUERY_DAYS,
  BOOKING_OPERATIONAL_TIMEZONE,
} from "@/lib/domain/booking-policy";
import {
  isPublicTeacher,
} from "@/lib/domain/teacher-application";
import {
  BookableSlotsRangeError,
  BookableTeacherNotFoundError,
} from "@/lib/errors/booking-errors";
import {
  Prisma,
} from "@/lib/generated/prisma/client";
import {
  projectAvailabilityForDate,
  type ProjectedAvailabilitySlot,
} from "@/lib/services/availability-projection.service";
import {
  instantToIranDateKey,
  iranLocalDateMinuteToInstant,
} from "@/lib/time/iran-booking-time";

const DAY_MS =
  24 * 60 * 60 * 1000;

const publicTeacherSelect = {
  id: true,
  applicationStatus: true,
  profileCompletedAt: true,

  user: {
    select: {
      accountStatus: true,
    },
  },

  introVideo: {
    select: {
      status: true,
    },
  },
} satisfies
  Prisma.TeacherProfileSelect;

export type BookableSlotsDateRange = {
  fromDate: string;
  toDate: string;
};

export type BookableSlotsResult = {
  teacherProfileId: string;
  timezone:
    typeof BOOKING_OPERATIONAL_TIMEZONE;

  fromDate: string;
  toDate: string;

  slots:
    ProjectedAvailabilitySlot[];
};

type ValidatedRange = {
  fromDate: Date;
  toDate: Date;
  dateKeys: string[];
};

function toDatabaseDate(
  dateKey: string,
): Date {
  const {
    year,
    month,
    day,
  } = parseBookingDateKey(
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

function toDateKey(
  date: Date,
): string {
  return date
    .toISOString()
    .slice(0, 10);
}

export function validateBookableSlotsRange(
  range:
    BookableSlotsDateRange,
): ValidatedRange {
  let fromDate: Date;
  let toDate: Date;

  try {
    fromDate =
      toDatabaseDate(
        range.fromDate,
      );

    toDate =
      toDatabaseDate(
        range.toDate,
      );
  } catch {
    throw new BookableSlotsRangeError(
      "INVALID_DATE_RANGE",
    );
  }

  if (
    toDate.getTime() <
    fromDate.getTime()
  ) {
    throw new BookableSlotsRangeError(
      "INVALID_DATE_RANGE",
    );
  }

  const inclusiveDays =
    Math.floor(
      (
        toDate.getTime() -
        fromDate.getTime()
      ) /
        DAY_MS,
    ) + 1;

  if (
    inclusiveDays >
    BOOKING_MAX_AVAILABILITY_QUERY_DAYS
  ) {
    throw new BookableSlotsRangeError(
      "RANGE_TOO_LARGE",
    );
  }

  const dateKeys:
    string[] = [];

  for (
    let timestamp =
      fromDate.getTime();
    timestamp <=
      toDate.getTime();
    timestamp +=
      DAY_MS
  ) {
    dateKeys.push(
      toDateKey(
        new Date(
          timestamp,
        ),
      ),
    );
  }

  return {
    fromDate,
    toDate,
    dateKeys,
  };
}

function assertTeacherProfileId(
  teacherProfileId: string,
): void {
  if (
    teacherProfileId.length === 0 ||
    teacherProfileId !==
      teacherProfileId.trim()
  ) {
    throw new BookableTeacherNotFoundError();
  }
}

export async function getBookableSlotsForTeacher(
  teacherProfileId: string,
  range:
    BookableSlotsDateRange,
  options: {
    now?: Date;
  } = {},
): Promise<BookableSlotsResult> {
  assertTeacherProfileId(
    teacherProfileId,
  );

  const validatedRange =
    validateBookableSlotsRange(
      range,
    );

  const teacher =
    await prisma.teacherProfile
      .findUnique({
        where: {
          id:
            teacherProfileId,
        },

        select:
          publicTeacherSelect,
      });

  if (
    !teacher ||
    !isPublicTeacher(
      teacher.user.accountStatus,
      teacher.applicationStatus,
      teacher.profileCompletedAt,
      teacher.introVideo
        ?.status ??
        null,
    )
  ) {
    /*
     * Deliberately fail closed.
     *
     * Public callers do not need to know
     * whether the profile is missing,
     * suspended, rejected, incomplete,
     * or has an unapproved intro video.
     */
    throw new BookableTeacherNotFoundError();
  }

  const rangeStartAt =
    iranLocalDateMinuteToInstant(
      range.fromDate,
      0,
    );

  const rangeEndExclusive =
    iranLocalDateMinuteToInstant(
      range.toDate,
      1440,
    );

  /*
   * Discovery is intentionally a projection,
   * not a reservation.
   *
   * These reads may become stale immediately
   * after returning. The booking transaction
   * will revalidate the slot before inserting
   * a durable SpeakingSession.
   */
  const [
    rules,
    exceptions,
    occupiedSessions,
  ] =
    await Promise.all([
      prisma
        .teacherAvailabilityRule
        .findMany({
          where: {
            teacherProfileId:
              teacher.id,
          },

          select: {
            weekday: true,
            startMinute: true,
            endMinute: true,
            isActive: true,
          },
        }),

      prisma
        .teacherAvailabilityException
        .findMany({
          where: {
            teacherProfileId:
              teacher.id,

            date: {
              gte:
                validatedRange
                  .fromDate,

              lte:
                validatedRange
                  .toDate,
            },
          },

          select: {
            date: true,
            startMinute: true,
            endMinute: true,
            type: true,
          },
        }),

      prisma
        .speakingSession
        .findMany({
          where: {
            teacherProfileId:
              teacher.id,

            status: {
              not:
                "CANCELLED",
            },

            startAt: {
              gte:
                rangeStartAt,

              lt:
                rangeEndExclusive,
            },
          },

          select: {
            startAt: true,
          },
        }),
    ]);

  const occupiedByDate =
    new Map<
      string,
      Date[]
    >();

  for (
    const session
    of occupiedSessions
  ) {
    const dateKey =
      instantToIranDateKey(
        session.startAt,
      );

    const existing =
      occupiedByDate.get(
        dateKey,
      );

    if (existing) {
      existing.push(
        session.startAt,
      );
    } else {
      occupiedByDate.set(
        dateKey,
        [
          session.startAt,
        ],
      );
    }
  }

  const projectionExceptions =
    exceptions.map(
      (exception) => ({
        date:
          toDateKey(
            exception.date,
          ),

        startMinute:
          exception.startMinute,

        endMinute:
          exception.endMinute,

        type:
          exception.type,
      }),
    );

  const now =
    options.now ??
    new Date();

  const slots =
    validatedRange
      .dateKeys
      .flatMap(
        (date) =>
          projectAvailabilityForDate({
            date,
            now,
            rules,
            exceptions:
              projectionExceptions,

            occupiedStartTimes:
              occupiedByDate.get(
                date,
              ) ??
              [],
          }),
      );

  return {
    teacherProfileId:
      teacher.id,

    timezone:
      BOOKING_OPERATIONAL_TIMEZONE,

    fromDate:
      range.fromDate,

    toDate:
      range.toDate,

    slots,
  };
}
/*
 * Batch projection for teacher discovery.
 *
 * This function intentionally does not resolve public-teacher
 * eligibility itself. The discovery layer supplies an already-batched
 * eligible candidate set, which keeps this projection path at three
 * database reads regardless of teacher count.
 *
 * This is a read/projection operation only. Booking creation remains
 * authoritative and independently re-checks teacher/slot eligibility.
 */
export async function getNextBookableAvailabilityForTeachers(
  teacherProfileIds: readonly string[],
  range: BookableSlotsDateRange,
  options: {
    now?: Date;
  } = {},
): Promise<Map<string, Date | null>> {
  const validatedRange =
    validateBookableSlotsRange(
      range,
    );

  /*
   * Set preserves first-seen insertion order, which also makes the
   * returned Map deterministic for duplicate candidate identifiers.
   */
  const uniqueTeacherProfileIds =
    [
      ...new Set(
        teacherProfileIds,
      ),
    ];

  for (
    const teacherProfileId
    of uniqueTeacherProfileIds
  ) {
    assertTeacherProfileId(
      teacherProfileId,
    );
  }

  const result =
    new Map<
      string,
      Date | null
    >(
      uniqueTeacherProfileIds.map(
        (
          teacherProfileId,
        ) => [
          teacherProfileId,
          null,
        ],
      ),
    );

  /*
   * Empty discovery pages must not touch PostgreSQL.
   */
  if (
    uniqueTeacherProfileIds.length ===
    0
  ) {
    return result;
  }

  const rangeStartAt =
    iranLocalDateMinuteToInstant(
      range.fromDate,
      0,
    );

  const rangeEndExclusive =
    iranLocalDateMinuteToInstant(
      range.toDate,
      1440,
    );

  /*
   * Constant query shape:
   *
   * 1. recurring availability
   * 2. date exceptions
   * 3. occupied speaking sessions
   *
   * Never replace this with one call to
   * getBookableSlotsForTeacher() per teacher.
   */
  const [
    rules,
    exceptions,
    sessions,
  ] =
    await Promise.all([
      prisma
        .teacherAvailabilityRule
        .findMany({
          where: {
            teacherProfileId: {
              in:
                uniqueTeacherProfileIds,
            },

            isActive:
              true,
          },

          select: {
            teacherProfileId:
              true,

            weekday:
              true,

            startMinute:
              true,

            endMinute:
              true,

            isActive:
              true,
          },
        }),

      prisma
        .teacherAvailabilityException
        .findMany({
          where: {
            teacherProfileId: {
              in:
                uniqueTeacherProfileIds,
            },

            date: {
              gte:
                validatedRange
                  .fromDate,

              lte:
                validatedRange
                  .toDate,
            },
          },

          select: {
            teacherProfileId:
              true,

            date:
              true,

            startMinute:
              true,

            endMinute:
              true,

            type:
              true,
          },
        }),

      prisma
        .speakingSession
        .findMany({
          where: {
            teacherProfileId: {
              in:
                uniqueTeacherProfileIds,
            },

            status: {
              not:
                "CANCELLED",
            },

            startAt: {
              gte:
                rangeStartAt,

              lt:
                rangeEndExclusive,
            },
          },

          select: {
            teacherProfileId:
              true,

            startAt:
              true,
          },
        }),
    ]);

  type BatchRule = {
    weekday:
      (typeof rules)[number]["weekday"];

    startMinute:
      number;

    endMinute:
      number;

    isActive:
      boolean;
  };

  type BatchException = {
    date:
      string;

    startMinute:
      number;

    endMinute:
      number;

    type:
      (typeof exceptions)[number]["type"];
  };

  const rulesByTeacher =
    new Map<
      string,
      BatchRule[]
    >();

  for (
    const rule
    of rules
  ) {
    const grouped =
      rulesByTeacher.get(
        rule.teacherProfileId,
      ) ??
      [];

    grouped.push({
      weekday:
        rule.weekday,

      startMinute:
        rule.startMinute,

      endMinute:
        rule.endMinute,

      isActive:
        rule.isActive,
    });

    rulesByTeacher.set(
      rule.teacherProfileId,
      grouped,
    );
  }

  const exceptionsByTeacher =
    new Map<
      string,
      BatchException[]
    >();

  for (
    const exception
    of exceptions
  ) {
    const grouped =
      exceptionsByTeacher.get(
        exception.teacherProfileId,
      ) ??
      [];

    grouped.push({
      date:
        toDateKey(
          exception.date,
        ),

      startMinute:
        exception.startMinute,

      endMinute:
        exception.endMinute,

      type:
        exception.type,
    });

    exceptionsByTeacher.set(
      exception.teacherProfileId,
      grouped,
    );
  }

  /*
   * teacherProfileId -> Tehran date -> occupied starts
   */
  const occupiedByTeacherAndDate =
    new Map<
      string,
      Map<
        string,
        Date[]
      >
    >();

  for (
    const session
    of sessions
  ) {
    const date =
      instantToIranDateKey(
        session.startAt,
      );

    const teacherDates =
      occupiedByTeacherAndDate.get(
        session.teacherProfileId,
      ) ??
      new Map<
        string,
        Date[]
      >();

    const occupiedStarts =
      teacherDates.get(
        date,
      ) ??
      [];

    occupiedStarts.push(
      session.startAt,
    );

    teacherDates.set(
      date,
      occupiedStarts,
    );

    occupiedByTeacherAndDate.set(
      session.teacherProfileId,
      teacherDates,
    );
  }

  const now =
    options.now ??
    new Date();

  /*
   * Projection is deliberately performed in memory after the three
   * batched reads. projectAvailabilityForDate() remains the single
   * source of truth for recurring + AVAILABLE - UNAVAILABLE,
   * occupied slots, lead time, horizon, and half-open behavior.
   */
  for (
    const teacherProfileId
    of uniqueTeacherProfileIds
  ) {
    const teacherRules =
      rulesByTeacher.get(
        teacherProfileId,
      ) ??
      [];

    const teacherExceptions =
      exceptionsByTeacher.get(
        teacherProfileId,
      ) ??
      [];

    const occupiedByDate =
      occupiedByTeacherAndDate.get(
        teacherProfileId,
      );

    let nextAvailableAt:
      Date | null =
        null;

    for (
      const date
      of validatedRange
        .dateKeys
    ) {
      const slots =
        projectAvailabilityForDate({
          date,

          now,

          rules:
            teacherRules,

          exceptions:
            teacherExceptions,

          occupiedStartTimes:
            occupiedByDate?.get(
              date,
            ) ??
            [],
        });

      for (
        const slot
        of slots
      ) {
        if (
          nextAvailableAt ===
            null ||
          slot.startAt.getTime() <
            nextAvailableAt.getTime()
        ) {
          nextAvailableAt =
            slot.startAt;
        }
      }
    }

    result.set(
      teacherProfileId,
      nextAvailableAt,
    );
  }

  return result;
}
