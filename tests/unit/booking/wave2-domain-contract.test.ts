import { describe, expect, it } from "vitest";

import { projectAvailabilityForDate } from "@/lib/services/availability-projection.service";

describe("Wave 2 locked booking-domain contract", () => {
  it("gives UNAVAILABLE precedence over an overlapping AVAILABLE exception", () => {
    const slots = projectAvailabilityForDate({
      date: "2026-08-15",
      rules: [],
      exceptions: [
        {
          date: "2026-08-15",
          startMinute: 540,
          endMinute: 600,
          type: "AVAILABLE",
        },
        {
          date: "2026-08-15",
          startMinute: 555,
          endMinute: 585,
          type: "UNAVAILABLE",
        },
      ],
      now: new Date("2026-08-10T08:00:00.000Z"),
    });

    expect(
      slots.map(({ startMinute, endMinute }) => ({
        startMinute,
        endMinute,
      })),
    ).toEqual([
      {
        startMinute: 540,
        endMinute: 555,
      },
      {
        startMinute: 585,
        endMinute: 600,
      },
    ]);
  });
});
