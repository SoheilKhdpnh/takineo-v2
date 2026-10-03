"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import type { BookableSlot } from "@/components/booking/student-booking-api";
import {
  groupBookableSlotsByDate,
  groupBookableSlotsByPeriod,
  paginateDates,
  periodForStartMinute,
  type SlotPeriod,
} from "@/components/booking/slot-picker-model";
import { Button } from "@/components/ui/Button";
import { BOOKING_OPERATIONAL_TIMEZONE } from "@/lib/domain/booking-policy";
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
  const grouped = useMemo(() => groupBookableSlotsByDate(slots), [slots]);
  const dates = useMemo(() => grouped.map((group) => group.date), [grouped]);
  const [viewedDateOverride, setViewedDateOverride] = useState<string | null>(
    null,
  );
  const [page, setPage] = useState(0);
  const [periodOverride, setPeriodOverride] = useState<SlotPeriod | null>(null);

  const selectedSlotDate = selectedStartAt
    ? grouped.find((group) =>
        group.slots.some((slot) => slot.startAt === selectedStartAt),
      )?.date
    : undefined;

  const viewedDate =
    viewedDateOverride && dates.includes(viewedDateOverride)
      ? viewedDateOverride
      : (selectedSlotDate ?? dates[0] ?? null);

  const weekdayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en", {
        timeZone: BOOKING_OPERATIONAL_TIMEZONE,
        weekday: "short",
      }),
    [locale],
  );

  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en", {
        timeZone: BOOKING_OPERATIONAL_TIMEZONE,
        day: "numeric",
      }),
    [locale],
  );

  const fullDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en", {
        timeZone: BOOKING_OPERATIONAL_TIMEZONE,
        weekday: "long",
        month: "long",
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

  const datePage = paginateDates(dates, page);
  const viewedGroup = grouped.find((group) => group.date === viewedDate) ?? null;
  const periodGroups = viewedGroup
    ? groupBookableSlotsByPeriod(viewedGroup.slots)
    : [];
  const availablePeriods = periodGroups.map((group) => group.period);
  const selectedSlotOnViewedDay = viewedGroup?.slots.find(
    (slot) => slot.startAt === selectedStartAt,
  );
  const viewedPeriod =
    periodOverride && availablePeriods.includes(periodOverride)
      ? periodOverride
      : selectedSlotOnViewedDay
        ? periodForStartMinute(selectedSlotOnViewedDay.startMinute)
        : (availablePeriods[0] ?? null);
  const visibleTimes =
    periodGroups.find((group) => group.period === viewedPeriod)?.slots ?? [];

  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-canvas px-5 py-10 text-center">
        <h3 className="text-lg font-semibold text-ink">{t("noSlotsTitle")}</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-ink-muted">
          {t("noSlotsDescription")}
        </p>
      </div>
    );
  }

  const viewedInstant = viewedGroup
    ? new Date(viewedGroup.slots[0].startAt)
    : null;
  const viewedDateLabel = viewedInstant
    ? fullDateFormatter.format(viewedInstant)
    : "";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">{t("chooseDay")}</p>
          {datePage.pageCount > 1 ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                aria-label={t("previousDays")}
                disabled={!datePage.hasPrevious || disabled}
                onClick={() => {
                  const previous = paginateDates(dates, datePage.page - 1);
                  setPage(previous.page);
                  if (previous.items[0]) {
                    setViewedDateOverride(previous.items[0]);
                  }
                }}
                className="size-10 min-h-10 px-0"
              >
                <span aria-hidden="true">‹</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label={t("nextDays")}
                disabled={!datePage.hasNext || disabled}
                onClick={() => {
                  const next = paginateDates(dates, datePage.page + 1);
                  setPage(next.page);
                  if (next.items[0]) {
                    setViewedDateOverride(next.items[0]);
                  }
                }}
                className="size-10 min-h-10 px-0"
              >
                <span aria-hidden="true">›</span>
              </Button>
            </div>
          ) : null}
        </div>

        <div
          role="radiogroup"
          aria-label={t("chooseDay")}
          className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7"
        >
          {datePage.items.map((date) => {
            const group = grouped.find((item) => item.date === date);
            if (!group) {
              return null;
            }

            const instant = new Date(group.slots[0].startAt);
            const selected = date === viewedDate;
            const holdsBookingSelection = group.slots.some(
              (slot) => slot.startAt === selectedStartAt,
            );

            return (
              <button
                key={date}
                type="button"
                aria-pressed={selected}
                aria-label={t("selectDate", {
                  date: fullDateFormatter.format(instant),
                  count: group.slots.length,
                })}
                disabled={disabled}
                onClick={() => setViewedDateOverride(date)}
                className={cn(
                  "flex min-h-[4.75rem] flex-col items-center justify-center rounded-lg border px-2 py-3 transition",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  selected
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "border-line bg-canvas text-ink hover:border-primary hover:bg-mint",
                )}
              >
                <span className={cn("text-xs font-semibold", selected ? "text-white/80" : "text-ink-muted")}>
                  {weekdayFormatter.format(instant)}
                </span>
                <span className="mt-1 font-display text-xl font-semibold leading-none">
                  {dayFormatter.format(instant)}
                </span>
                <span className={cn("mt-2 text-[11px] font-medium", selected ? "text-white/80" : "text-ink-muted")}>
                  {t("slotCount", { count: group.slots.length })}
                </span>
                {holdsBookingSelection && !selected ? (
                  <span className="mt-1 size-1.5 rounded-full bg-primary" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {viewedGroup && viewedInstant ? (
        <div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">{t("chooseTimeOfDay")}</p>
              <p className="mt-1 text-sm text-ink-muted">{viewedDateLabel}</p>
            </div>
            <span className="text-xs font-medium text-ink-muted">
              {t("slotCount", { count: visibleTimes.length })}
            </span>
          </div>

          <div
            role="group"
            aria-label={t("slotsForDate", { date: viewedDateLabel })}
            className="mt-4 space-y-4"
          >
            {availablePeriods.length > 1 ? (
              <div
                role="radiogroup"
                aria-label={t("chooseTimeOfDay")}
                className="grid grid-cols-3 gap-2"
              >
                {periodGroups.map((group) => {
                  const selected = group.period === viewedPeriod;
                  return (
                    <button
                      key={group.period}
                      type="button"
                      aria-pressed={selected}
                      aria-label={t(group.period)}
                      disabled={disabled}
                      onClick={() => setPeriodOverride(group.period)}
                      className={cn(
                        "rounded-md border px-3 py-2 text-sm font-semibold transition",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        selected
                          ? "border-primary bg-mint text-ink"
                          : "border-line bg-canvas text-ink-muted hover:border-primary hover:text-ink",
                      )}
                    >
                      {t(group.period)}
                      <span className="mt-0.5 block text-[11px] font-medium opacity-80">
                        {t("slotCount", { count: group.slots.length })}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {visibleTimes.map((slot) => {
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
                      "min-h-12 rounded-md border px-3 py-2.5 text-sm font-semibold transition",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      selected
                        ? "border-primary bg-primary text-white shadow-sm"
                        : "border-line bg-surface text-ink hover:border-primary hover:bg-mint",
                    )}
                  >
                    <span dir="ltr">{timeLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
