import { afterEach, describe, expect, it } from "vitest";

import {
  BOOKING_OPERATIONAL_TIMEZONE,
} from "@/lib/domain/booking-policy";
import {
  instantToIranDateKey,
  instantToIranMinuteOfDay,
  iranLocalDateMinuteToInstant,
} from "@/lib/time/iran-booking-time";

const originalTimezone = process.env.TZ;

type TehranParts = {
  dateKey: string;
  minuteOfDay: number;
};

function getIanaTehranParts(instant: Date): TehranParts {
  const formatter = new Intl.DateTimeFormat(
    "en-US-u-ca-gregory-nu-latn",
    {
      timeZone: BOOKING_OPERATIONAL_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    },
  );

  const parts = Object.fromEntries(
    formatter
      .formatToParts(instant)
      .filter(({ type }) =>
        ["year", "month", "day", "hour", "minute"].includes(type),
      )
      .map(({ type, value }) => [type, value]),
  );

  const hour = Number(parts.hour);
  const minute = Number(parts.minute);

  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minuteOfDay: hour * 60 + minute,
  };
}

afterEach(() => {
  if (originalTimezone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTimezone;
  }
});

describe("Wave 2 Tehran civil-time contract", () => {
  it("uses Asia/Tehran as the scheduling timezone authority", () => {
    expect(BOOKING_OPERATIONAL_TIMEZONE).toBe("Asia/Tehran");
  });

  it.each([
    "2026-01-15T00:00:00.000Z",
    "2026-03-20T20:45:00.000Z",
    "2026-06-21T12:00:00.000Z",
    "2026-08-15T20:45:00.000Z",
    "2026-12-31T20:45:00.000Z",
  ])(
    "matches IANA Asia/Tehran civil date and minute for %s",
    (iso) => {
      const instant = new Date(iso);
      const expected = getIanaTehranParts(instant);

      expect(instantToIranDateKey(instant)).toBe(
        expected.dateKey,
      );

      expect(instantToIranMinuteOfDay(instant)).toBe(
        expected.minuteOfDay,
      );
    },
  );

  it("correctly crosses the Tehran civil-date boundary around UTC midnight", () => {
    const instant = new Date(
      "2026-08-15T20:45:00.000Z",
    );

    expect(getIanaTehranParts(instant)).toEqual({
      dateKey: "2026-08-16",
      minuteOfDay: 15,
    });

    expect(instantToIranDateKey(instant)).toBe(
      "2026-08-16",
    );

    expect(instantToIranMinuteOfDay(instant)).toBe(15);
  });

  it("converts Tehran civil date/minute back to the matching instant", () => {
    const instant = iranLocalDateMinuteToInstant(
      "2026-08-16",
      15,
    );

    expect(getIanaTehranParts(instant)).toEqual({
      dateKey: "2026-08-16",
      minuteOfDay: 15,
    });

    expect(instant.toISOString()).toBe(
      "2026-08-15T20:45:00.000Z",
    );
  });

  it("does not let the runtime local timezone change booking semantics", () => {
    const instant = new Date(
      "2026-08-15T20:45:00.000Z",
    );

    const expected = {
      dateKey: "2026-08-16",
      minuteOfDay: 15,
      inverse: "2026-08-15T20:45:00.000Z",
    };

    for (const runtimeTimezone of [
      "UTC",
      "America/Los_Angeles",
      "Europe/Helsinki",
      "Asia/Tokyo",
    ]) {
      process.env.TZ = runtimeTimezone;

      expect({
        dateKey: instantToIranDateKey(instant),
        minuteOfDay:
          instantToIranMinuteOfDay(instant),
        inverse:
          iranLocalDateMinuteToInstant(
            "2026-08-16",
            15,
          ).toISOString(),
      }).toEqual(expected);
    }
  });
});
