"use client";

import {
  useLocale,
  useTranslations,
} from "next-intl";

import {
  BOOKING_WEEKDAYS,
  type BookingWeekday,
} from "@/lib/domain/booking";
import {
  BOOKING_SLOT_MINUTES,
} from "@/lib/domain/booking-policy";
import type {
  TeacherAvailabilityRuleInput,
} from "@/components/availability/teacher-availability-api";

export type WeeklyDraftRule =
  TeacherAvailabilityRuleInput & {
    key: string;
  };

const TIME_OPTIONS = Array.from(
  {
    length:
      Math.floor(
        1440 /
          BOOKING_SLOT_MINUTES,
      ) + 1,
  },
  (_, index) =>
    index * BOOKING_SLOT_MINUTES,
);

interface WeeklyAvailabilityEditorProps {
  rules: WeeklyDraftRule[];
  dirty: boolean;
  disabled: boolean;
  saving: boolean;
  error: string | null;
  formatMinute: (minute: number) => string;
  onAdd: (weekday: BookingWeekday) => void;
  onUpdate: (
    key: string,
    patch: Partial<TeacherAvailabilityRuleInput>,
  ) => void;
  onRemove: (key: string) => void;
  onReset: () => void;
  onSave: () => void;
}

export function WeeklyAvailabilityEditor({
  rules,
  dirty,
  disabled,
  saving,
  error,
  formatMinute,
  onAdd,
  onUpdate,
  onRemove,
  onReset,
  onSave,
}: WeeklyAvailabilityEditorProps) {
  const locale = useLocale();
  const t = useTranslations(
    "TeacherAvailability",
  );

  return (
    <section aria-labelledby="weekly-availability-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p
            className={[
              "text-xs font-bold text-zinc-400",
              locale === "fa"
                ? "tracking-normal"
                : "uppercase tracking-[0.16em]",
            ].join(" ")}
          >
            {t("weeklyEyebrow")}
          </p>
          <h3
            id="weekly-availability-heading"
            className="mt-2 text-xl font-semibold text-zinc-950 sm:text-2xl"
          >
            {t("weeklyTitle")}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-600">
            {t("weeklyDescription")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={
              !dirty ||
              disabled
            }
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("resetWeekly")}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={
              !dirty ||
              disabled
            }
            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving
              ? t("savingWeekly")
              : t("saveWeekly")}
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-7 text-red-900"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {BOOKING_WEEKDAYS.map(
          (weekday) => {
            const dayRules =
              rules.filter(
                (rule) =>
                  rule.weekday ===
                  weekday,
              );

            return (
              <article
                key={weekday}
                className="rounded-3xl border border-zinc-200 bg-zinc-50/70 p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-zinc-950">
                      {t(
                        `weekdays.${weekday}`,
                      )}
                    </h4>
                    <p className="mt-1 text-xs text-zinc-500">
                      {dayRules.length === 0
                        ? t("noWeeklyWindows")
                        : t("weeklyWindowCount", {
                            count:
                              dayRules.length,
                          })}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onAdd(weekday)
                    }
                    disabled={disabled}
                    className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 transition hover:border-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("addWindow")}
                  </button>
                </div>

                {dayRules.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {dayRules.map(
                      (rule, index) => (
                        <fieldset
                          key={rule.key}
                          className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                        >
                          <legend className="sr-only">
                            {t("windowLegend", {
                              day: t(
                                `weekdays.${weekday}`,
                              ),
                              index:
                                index + 1,
                            })}
                          </legend>

                          <label className="grid gap-2 text-sm font-medium text-zinc-700">
                            {t("startTime")}
                            <select
                              value={
                                rule.startMinute
                              }
                              onChange={(event) =>
                                onUpdate(
                                  rule.key,
                                  {
                                    startMinute:
                                      Number(
                                        event
                                          .target
                                          .value,
                                      ),
                                  },
                                )
                              }
                              disabled={disabled}
                              className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 disabled:opacity-60"
                            >
                              {TIME_OPTIONS.map(
                                (minute) => (
                                  <option
                                    key={minute}
                                    value={minute}
                                  >
                                    {formatMinute(
                                      minute,
                                    )}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>

                          <label className="grid gap-2 text-sm font-medium text-zinc-700">
                            {t("endTime")}
                            <select
                              value={
                                rule.endMinute
                              }
                              onChange={(event) =>
                                onUpdate(
                                  rule.key,
                                  {
                                    endMinute:
                                      Number(
                                        event
                                          .target
                                          .value,
                                      ),
                                  },
                                )
                              }
                              disabled={disabled}
                              className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 disabled:opacity-60"
                            >
                              {TIME_OPTIONS.map(
                                (minute) => (
                                  <option
                                    key={minute}
                                    value={minute}
                                  >
                                    {formatMinute(
                                      minute,
                                    )}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>

                          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                            <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-700">
                              <input
                                type="checkbox"
                                checked={
                                  rule.isActive
                                }
                                onChange={(event) =>
                                  onUpdate(
                                    rule.key,
                                    {
                                      isActive:
                                        event
                                          .target
                                          .checked,
                                    },
                                  )
                                }
                                disabled={disabled}
                                className="size-4 accent-zinc-950"
                              />
                              {t("active")}
                            </label>

                            <button
                              type="button"
                              onClick={() =>
                                onRemove(
                                  rule.key,
                                )
                              }
                              disabled={disabled}
                              className="min-h-11 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-800 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              {t("removeWindow")}
                            </button>
                          </div>
                        </fieldset>
                      ),
                    )}
                  </div>
                ) : null}
              </article>
            );
          },
        )}
      </div>

      <p className="mt-4 rounded-2xl bg-zinc-100 px-4 py-3 text-xs leading-6 text-zinc-600">
        {t("replacementNotice")}
      </p>
    </section>
  );
}
