import {
  parseBookingDateKey,
} from "@/lib/domain/booking";
import {
  BOOKING_IRAN_UTC_OFFSET_MINUTES,
  BOOKING_MAX_HORIZON_DAYS,
  BOOKING_MIN_LEAD_MINUTES,
} from "@/lib/domain/booking-policy";

const MINUTE_MS = 60_000;
const DAY_MS =
  24 * 60 * MINUTE_MS;

export function iranLocalDateMinuteToInstant(
  dateKey: string,
  minuteOfDay: number,
): Date {
  const {
    year,
    month,
    day,
  } = parseBookingDateKey(
    dateKey,
  );

  if (
    !Number.isInteger(
      minuteOfDay,
    ) ||
    minuteOfDay < 0 ||
    minuteOfDay > 1440
  ) {
    throw new Error(
      "Invalid Iran-local minute of day.",
    );
  }

  const iranMidnightAsUtc =
    Date.UTC(
      year,
      month - 1,
      day,
      0,
      0,
      0,
      0,
    ) -
    BOOKING_IRAN_UTC_OFFSET_MINUTES *
      MINUTE_MS;

  return new Date(
    iranMidnightAsUtc +
      minuteOfDay * MINUTE_MS,
  );
}

export function instantToIranDateKey(
  instant: Date,
): string {
  const shifted =
    new Date(
      instant.getTime() +
        BOOKING_IRAN_UTC_OFFSET_MINUTES *
          MINUTE_MS,
    );

  const year =
    shifted.getUTCFullYear();

  const month = String(
    shifted.getUTCMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    shifted.getUTCDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function instantToIranMinuteOfDay(
  instant: Date,
): number {
  const shifted =
    new Date(
      instant.getTime() +
        BOOKING_IRAN_UTC_OFFSET_MINUTES *
          MINUTE_MS,
    );

  return (
    shifted.getUTCHours() * 60 +
    shifted.getUTCMinutes()
  );
}

export function getBookingWindow(
  now: Date,
): {
  earliestStartAt: Date;
  latestStartAt: Date;
} {
  return {
    earliestStartAt:
      new Date(
        now.getTime() +
          BOOKING_MIN_LEAD_MINUTES *
            MINUTE_MS,
      ),

    latestStartAt:
      new Date(
        now.getTime() +
          BOOKING_MAX_HORIZON_DAYS *
            DAY_MS,
      ),
  };
}
