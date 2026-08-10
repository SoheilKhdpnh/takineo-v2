import "server-only";

import {
  getBookingWeekday,
  type AvailabilityExceptionType,
  type BookingWeekday,
  type MinuteInterval,
} from "@/lib/domain/booking";
import {
  BOOKING_SESSION_MINUTES,
  BOOKING_SLOT_MINUTES,
} from "@/lib/domain/booking-policy";
import {
  getBookingWindow,
  iranLocalDateMinuteToInstant,
} from "@/lib/time/iran-booking-time";

export type ProjectionAvailabilityRule = {
  weekday: BookingWeekday;
  startMinute: number;
  endMinute: number;
  isActive: boolean;
};

export type ProjectionAvailabilityException = {
  date: string;
  startMinute: number;
  endMinute: number;
  type: AvailabilityExceptionType;
};

export type ProjectedAvailabilitySlot = {
  date: string;
  startMinute: number;
  endMinute: number;
  startAt: Date;
  endAt: Date;
};

export type AvailabilityProjectionInput = {
  date: string;
  rules:
    readonly ProjectionAvailabilityRule[];
  exceptions:
    readonly ProjectionAvailabilityException[];
  occupiedStartTimes?:
    readonly Date[];
  now?: Date;
};

function mergeIntervals(
  intervals:
    readonly MinuteInterval[],
): MinuteInterval[] {
  if (
    intervals.length === 0
  ) {
    return [];
  }

  const sorted =
    [...intervals].sort(
      (first, second) =>
        first.startMinute -
        second.startMinute ||
        first.endMinute -
        second.endMinute,
    );

  const merged:
    MinuteInterval[] = [];

  for (
    const interval
    of sorted
  ) {
    const previous =
      merged[
        merged.length - 1
      ];

    if (
      !previous ||
      interval.startMinute >
        previous.endMinute
    ) {
      merged.push({
        ...interval,
      });

      continue;
    }

    previous.endMinute =
      Math.max(
        previous.endMinute,
        interval.endMinute,
      );
  }

  return merged;
}

function subtractInterval(
  source:
    MinuteInterval,
  blocked:
    MinuteInterval,
): MinuteInterval[] {
  if (
    blocked.endMinute <=
      source.startMinute ||
    blocked.startMinute >=
      source.endMinute
  ) {
    return [
      source,
    ];
  }

  const result:
    MinuteInterval[] = [];

  if (
    blocked.startMinute >
    source.startMinute
  ) {
    result.push({
      startMinute:
        source.startMinute,

      endMinute:
        Math.min(
          blocked.startMinute,
          source.endMinute,
        ),
    });
  }

  if (
    blocked.endMinute <
    source.endMinute
  ) {
    result.push({
      startMinute:
        Math.max(
          blocked.endMinute,
          source.startMinute,
        ),

      endMinute:
        source.endMinute,
    });
  }

  return result;
}

function subtractIntervals(
  source:
    readonly MinuteInterval[],
  blocked:
    readonly MinuteInterval[],
): MinuteInterval[] {
  let result =
    [...source];

  for (
    const blockedInterval
    of blocked
  ) {
    result =
      result.flatMap(
        (interval) =>
          subtractInterval(
            interval,
            blockedInterval,
          ),
      );
  }

  return result;
}

export function projectAvailabilityForDate(
  input:
    AvailabilityProjectionInput,
): ProjectedAvailabilitySlot[] {
  const now =
    input.now ??
    new Date();

  const weekday =
    getBookingWeekday(
      input.date,
    );

  const recurring =
    input.rules
      .filter(
        (rule) =>
          rule.isActive &&
          rule.weekday ===
            weekday,
      )
      .map(
        (rule) => ({
          startMinute:
            rule.startMinute,
          endMinute:
            rule.endMinute,
        }),
      );

  const exceptions =
    input.exceptions.filter(
      (exception) =>
        exception.date ===
        input.date,
    );

  const additions =
    exceptions
      .filter(
        (exception) =>
          exception.type ===
          "AVAILABLE",
      )
      .map(
        (exception) => ({
          startMinute:
            exception.startMinute,
          endMinute:
            exception.endMinute,
        }),
      );

  const removals =
    exceptions
      .filter(
        (exception) =>
          exception.type ===
          "UNAVAILABLE",
      )
      .map(
        (exception) => ({
          startMinute:
            exception.startMinute,
          endMinute:
            exception.endMinute,
        }),
      );

  const availableWindows =
    subtractIntervals(
      mergeIntervals([
        ...recurring,
        ...additions,
      ]),
      mergeIntervals(
        removals,
      ),
    );

  const occupied =
    new Set(
      (
        input
          .occupiedStartTimes ??
        []
      ).map(
        (instant) =>
          instant.getTime(),
      ),
    );

  const {
    earliestStartAt,
    latestStartAt,
  } = getBookingWindow(
    now,
  );

  const slots:
    ProjectedAvailabilitySlot[] =
      [];

  for (
    const window
    of availableWindows
  ) {
    for (
      let startMinute =
        window.startMinute;
      startMinute +
        BOOKING_SESSION_MINUTES <=
      window.endMinute;
      startMinute +=
        BOOKING_SLOT_MINUTES
    ) {
      const endMinute =
        startMinute +
        BOOKING_SESSION_MINUTES;

      const startAt =
        iranLocalDateMinuteToInstant(
          input.date,
          startMinute,
        );

      if (
        startAt <
          earliestStartAt ||
        startAt >
          latestStartAt
      ) {
        continue;
      }

      if (
        occupied.has(
          startAt.getTime(),
        )
      ) {
        continue;
      }

      const endAt =
        iranLocalDateMinuteToInstant(
          input.date,
          endMinute,
        );

      slots.push({
        date:
          input.date,
        startMinute,
        endMinute,
        startAt,
        endAt,
      });
    }
  }

  return slots.sort(
    (first, second) =>
      first.startAt.getTime() -
      second.startAt.getTime(),
  );
}
