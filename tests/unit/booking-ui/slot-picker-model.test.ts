import { describe, expect, it } from "vitest";

import type { BookableSlot } from "@/components/booking/student-booking-api";
import {
  groupBookableSlotsByDate,
  groupBookableSlotsByPeriod,
  pageIndexForDate,
  paginateDates,
  periodForStartMinute,
} from "@/components/booking/slot-picker-model";

function slot(partial: Partial<BookableSlot> & Pick<BookableSlot, "date" | "startMinute">): BookableSlot {
  return {
    endMinute: partial.startMinute + 15,
    startAt: `${partial.date}T00:00:00.000Z`,
    endAt: `${partial.date}T00:15:00.000Z`,
    ...partial,
  };
}

describe("slot picker model", () => {
  it("groups slots by calendar date in first-seen order", () => {
    const grouped = groupBookableSlotsByDate([
      slot({ date: "2026-08-20", startMinute: 540 }),
      slot({ date: "2026-08-22", startMinute: 600 }),
      slot({ date: "2026-08-20", startMinute: 555 }),
    ]);

    expect(grouped.map((group) => group.date)).toEqual([
      "2026-08-20",
      "2026-08-22",
    ]);
    expect(grouped[0]?.slots).toHaveLength(2);
  });

  it("splits Iran-local minutes into morning, afternoon, and evening", () => {
    expect(periodForStartMinute(540)).toBe("morning");
    expect(periodForStartMinute(720)).toBe("afternoon");
    expect(periodForStartMinute(1020)).toBe("evening");

    const periods = groupBookableSlotsByPeriod([
      slot({ date: "2026-08-20", startMinute: 1020 }),
      slot({ date: "2026-08-20", startMinute: 540 }),
      slot({ date: "2026-08-20", startMinute: 780 }),
    ]);

    expect(periods.map((group) => group.period)).toEqual([
      "morning",
      "afternoon",
      "evening",
    ]);
  });

  it("pages available dates seven at a time", () => {
    const dates = [
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
    ];

    expect(paginateDates(dates, 0).items).toHaveLength(7);
    expect(paginateDates(dates, 0).hasNext).toBe(true);
    expect(paginateDates(dates, 1).items).toEqual(["2026-08-27"]);
    expect(pageIndexForDate(dates, "2026-08-27")).toBe(1);
  });
});
