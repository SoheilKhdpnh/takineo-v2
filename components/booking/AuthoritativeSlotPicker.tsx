"use client";

import {
  useLocale,
  useTranslations,
} from "next-intl";
import {
  useMemo,
} from "react";

import type {
  BookableSlot,
} from "@/components/booking/student-booking-api";
import {
  BOOKING_OPERATIONAL_TIMEZONE,
} from "@/lib/domain/booking-policy";

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
  const t = useTranslations(
    "StudentBooking",
  );

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(
        locale === "fa"
          ? "fa-IR"
          : "en",
        {
          timeZone:
            BOOKING_OPERATIONAL_TIMEZONE,
          weekday: "long",
          month: "long",
          day: "numeric",
        },
      ),
    [locale],
  );

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(
        locale === "fa"
          ? "fa-IR"
          : "en",
        {
          timeZone:
            BOOKING_OPERATIONAL_TIMEZONE,
          hour: "2-digit",
          minute: "2-digit",
        },
      ),
    [locale],
  );

  const grouped = useMemo(() => {
    const groups:
      Array<{
        date: string;
        slots: BookableSlot[];
      }> = [];

    const byDate = new Map<
      string,
      BookableSlot[]
    >();

    for (const slot of slots) {
      const existing = byDate.get(
        slot.date,
      );

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

  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-canvas px-5 py-10 text-center">
        <h3 className="text-lg font-semibold text-ink">
          {t("noSlotsTitle")}
        </h3>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-ink-muted">
          {t("noSlotsDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map((group) => {
        const dateLabel =
          dateFormatter.format(
            new Date(
              group.slots[0].startAt,
            ),
          );

        return (
          <section
            key={group.date}
            aria-labelledby={`booking-date-${group.date}`}
          >
            <div className="flex items-center justify-between gap-4">
              <h3
                id={`booking-date-${group.date}`}
                className="text-base font-semibold text-ink"
              >
                {dateLabel}
              </h3>
              <span className="text-xs font-medium text-ink-muted">
                {t("slotCount", {
                  count:
                    group.slots.length,
                })}
              </span>
            </div>

            <div
              role="group"
              aria-label={t(
                "slotsForDate",
                {
                  date: dateLabel,
                },
              )}
              className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
            >
              {group.slots.map((slot) => {
                const selected =
                  slot.startAt ===
                  selectedStartAt;

                const timeLabel =
                  timeFormatter.format(
                    new Date(
                      slot.startAt,
                    ),
                  );

                return (
                  <button
                    key={slot.startAt}
                    type="button"
                    aria-pressed={selected}
                    aria-label={t(
                      "selectSlot",
                      {
                        time: timeLabel,
                      },
                    )}
                    disabled={disabled}
                    onClick={() =>
                      onSelect(slot)
                    }
                    className={[
                      "rounded-md border px-3 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50",
                      selected
                        ? "border-primary bg-primary text-white shadow-sm"
                        : "border-line bg-surface text-ink hover:border-primary hover:bg-mint",
                    ].join(" ")}
                  >
                    {timeLabel}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
