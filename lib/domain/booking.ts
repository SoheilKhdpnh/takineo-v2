export const BOOKING_WEEKDAYS = [
  "SATURDAY",
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
] as const;

export type BookingWeekday =
  (typeof BOOKING_WEEKDAYS)[number];

export const AVAILABILITY_EXCEPTION_TYPES = [
  "AVAILABLE",
  "UNAVAILABLE",
] as const;

export type AvailabilityExceptionType =
  (typeof AVAILABILITY_EXCEPTION_TYPES)[number];

export type MinuteInterval = {
  startMinute: number;
  endMinute: number;
};

const JAVASCRIPT_WEEKDAY_TO_BOOKING_WEEKDAY:
  readonly BookingWeekday[] = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ];

export function isQuarterHourMinute(
  minute: number,
): boolean {
  return (
    Number.isInteger(minute) &&
    minute % 15 === 0
  );
}

export function isValidMinuteInterval(
  interval: MinuteInterval,
): boolean {
  return (
    Number.isInteger(
      interval.startMinute,
    ) &&
    Number.isInteger(
      interval.endMinute,
    ) &&
    interval.startMinute >= 0 &&
    interval.endMinute <= 1440 &&
    interval.startMinute <
      interval.endMinute &&
    isQuarterHourMinute(
      interval.startMinute,
    ) &&
    isQuarterHourMinute(
      interval.endMinute,
    )
  );
}

export function intervalsOverlap(
  first: MinuteInterval,
  second: MinuteInterval,
): boolean {
  return (
    first.startMinute <
      second.endMinute &&
    second.startMinute <
      first.endMinute
  );
}

export function parseBookingDateKey(
  value: string,
): {
  year: number;
  month: number;
  day: number;
} {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  if (!match) {
    throw new Error(
      "Invalid booking date key.",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const candidate =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  if (
    candidate.getUTCFullYear() !==
      year ||
    candidate.getUTCMonth() !==
      month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error(
      "Invalid booking calendar date.",
    );
  }

  return {
    year,
    month,
    day,
  };
}

export function isBookingDateKey(
  value: string,
): boolean {
  try {
    parseBookingDateKey(value);
    return true;
  } catch {
    return false;
  }
}

export function getBookingWeekday(
  dateKey: string,
): BookingWeekday {
  const {
    year,
    month,
    day,
  } = parseBookingDateKey(
    dateKey,
  );

  const jsWeekday =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    ).getUTCDay();

  const weekday =
    JAVASCRIPT_WEEKDAY_TO_BOOKING_WEEKDAY[
      jsWeekday
    ];

  if (!weekday) {
    throw new Error(
      "Could not resolve booking weekday.",
    );
  }

  return weekday;
}
