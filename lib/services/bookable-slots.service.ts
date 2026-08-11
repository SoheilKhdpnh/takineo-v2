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

function validateRange(
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
    validateRange(
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
