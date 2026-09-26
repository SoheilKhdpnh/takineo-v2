"use client";

import {
  useLocale,
  useTranslations,
} from "next-intl";
import {
  useMemo,
  useState,
} from "react";

import type {
  BookableSlot,
} from "@/components/booking/student-booking-api";
import {
  BOOKING_OPERATIONAL_TIMEZONE,
} from "@/lib/domain/booking-policy";
import { cn } from "@/lib/ui/cn";

type AuthoritativeSlotPickerProps = {
  slots: BookableSlot[];
  selectedStartAt: string | null;
  onSelect: (slot: BookableSlot) => void;
  disabled?: boolean;
};

export function AuthoritativeSlotPicker({
  slots,
  selectedStartAt,
  onSelect,
  disabled = false,
}: AuthoritativeSlotPickerProps) {
  const locale = useLocale();
  const t = useTranslations("StudentBooking");

  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en", {
        timeZone: BOOKING_OPERATIONAL_TIMEZONE,
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    [locale],
  );

  const weekdayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en", {
        timeZone: BOOKING_OPERATIONAL_TIMEZONE,
        weekday: "short",
      }),
    [locale],
  );

  const dayNumberFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en", {
        timeZone: BOOKING_OPERATIONAL_TIMEZONE,
        day: "numeric",
      }),
    [locale],
  );

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en", {
        timeZone: BOOKING_OPERATIONAL_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale],
  );

  const grouped = useMemo(() => {
    const groups: Array<{
      date: string;
      slots: BookableSlot[];
    }> = [];
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
  }, [slots]);

  const selectedDateFromSlot = useMemo(() => {
    if (!selectedStartAt) {
      return null;
    }

    return (
      slots.find((slot) => slot.startAt === selectedStartAt)?.date ?? null
    );
  }, [selectedStartAt, slots]);

  const [pickedDate, setPickedDate] = useState<string | null>(null);

  const activeDate =
    (selectedDateFromSlot &&
    grouped.some((group) => group.date === selectedDateFromSlot)
      ? selectedDateFromSlot
      : null) ??
    (pickedDate && grouped.some((group) => group.date === pickedDate)
      ? pickedDate
      : null) ??
    grouped[0]?.date ??
    null;

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#edddd4] bg-[#fffaf6] px-5 py-8 text-center">
        <h3 className="text-base font-semibold text-[#1c1410]">
          {t("noSlotsTitle")}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
          {t("noSlotsDescription")}
        </p>
      </div>
    );
  }

  const activeGroup =
    grouped.find((group) => group.date === activeDate) ?? grouped[0];

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={t("slotDaysLabel")}
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {grouped.map((group) => {
          const pressed = group.date === activeGroup.date;
          const sample = new Date(group.slots[0].startAt);

          return (
            <button
              key={group.date}
              type="button"
              role="tab"
              aria-selected={pressed}
              disabled={disabled}
              onClick={() => setPickedDate(group.date)}
              className={cn(
                "inline-flex min-w-[4.75rem] shrink-0 flex-col items-center rounded-2xl border px-3 py-2 transition disabled:cursor-not-allowed disabled:opacity-50",
                pressed
                  ? "border-[#c2410c] bg-[#c2410c] text-white"
                  : "border-[#edddd4] bg-white text-[#1c1410] hover:border-[#fdba74] hover:bg-[#fff4ed]",
              )}
            >
              <span className="text-[0.7rem] font-semibold tracking-wide opacity-80">
                {weekdayFormatter.format(sample)}
              </span>
              <span className="mt-0.5 text-sm font-bold">
                {dayNumberFormatter.format(sample)}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="group"
        aria-label={t("slotsForDate", {
          date: dayFormatter.format(new Date(activeGroup.slots[0].startAt)),
        })}
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      >
        {activeGroup.slots.map((slot) => {
          const selected = slot.startAt === selectedStartAt;
          const timeLabel = timeFormatter.format(new Date(slot.startAt));

          return (
            <button
              key={slot.startAt}
              type="button"
              aria-pressed={selected}
              aria-label={t("selectSlot", { time: timeLabel })}
              disabled={disabled}
              onClick={() => onSelect(slot)}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c2410c] disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "border-[#c2410c] bg-[#c2410c] text-white"
                  : "border-[#edddd4] bg-[#fffaf6] text-[#1c1410] hover:border-[#fdba74] hover:bg-[#fff4ed]",
              )}
            >
              {timeLabel}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-zinc-500">
        {t("slotCount", { count: activeGroup.slots.length })} · {t("tehranTime")}
      </p>
    </div>
  );
}
