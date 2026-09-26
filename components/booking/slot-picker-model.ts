import type { BookableSlot } from "@/components/booking/student-booking-api";

export const SLOT_DATE_PAGE_SIZE = 7;

export type SlotDayGroup = {
  date: string;
  slots: BookableSlot[];
};

export type SlotPeriod = "morning" | "afternoon" | "evening";

export type SlotPeriodGroup = {
  period: SlotPeriod;
  slots: BookableSlot[];
};

export const SLOT_PERIODS: readonly SlotPeriod[] = [
  "morning",
  "afternoon",
  "evening",
];

export function groupBookableSlotsByDate(
  slots: BookableSlot[],
): SlotDayGroup[] {
  const groups: SlotDayGroup[] = [];
  const byDate = new Map<string, BookableSlot[]>();

  for (const slot of slots) {
    const existing = byDate.get(slot.date);

    if (existing) {
      existing.push(slot);
      continue;
    }

    const next = [slot];
    byDate.set(slot.date, next);
    groups.push({
      date: slot.date,
      slots: next,
    });
  }

  return groups;
}

export function periodForStartMinute(startMinute: number): SlotPeriod {
  if (startMinute < 12 * 60) {
    return "morning";
  }

  if (startMinute < 17 * 60) {
    return "afternoon";
  }

  return "evening";
}

export function groupBookableSlotsByPeriod(
  slots: BookableSlot[],
): SlotPeriodGroup[] {
  const buckets: Record<SlotPeriod, BookableSlot[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  for (const slot of slots) {
    buckets[periodForStartMinute(slot.startMinute)].push(slot);
  }

  return SLOT_PERIODS.flatMap((period) => {
    const periodSlots = buckets[period];
    return periodSlots.length > 0 ? [{ period, slots: periodSlots }] : [];
  });
}

export function paginateDates(
  dates: string[],
  page: number,
  pageSize = SLOT_DATE_PAGE_SIZE,
) {
  const pageCount = Math.max(1, Math.ceil(dates.length / pageSize));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const start = safePage * pageSize;

  return {
    items: dates.slice(start, start + pageSize),
    page: safePage,
    pageCount,
    hasPrevious: safePage > 0,
    hasNext: start + pageSize < dates.length,
  };
}

export function pageIndexForDate(
  dates: string[],
  date: string,
  pageSize = SLOT_DATE_PAGE_SIZE,
) {
  const index = dates.indexOf(date);
  if (index < 0) {
    return 0;
  }

  return Math.floor(index / pageSize);
}
