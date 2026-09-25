"use client";

import { useTranslations } from "next-intl";

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
import {
  PlusIcon,
  TrashIcon,
} from "@/components/ui/WorkspaceIcons";
import { cn } from "@/lib/ui/cn";

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

const timeSelectClassName =
  "min-h-9 appearance-none rounded-lg border border-transparent bg-[#fffaf6] px-2 text-sm font-semibold text-zinc-900 tabular-nums outline-none transition hover:border-[#edddd4] focus:border-[#c2410c] focus:ring-2 focus:ring-[#c2410c]/15 disabled:opacity-60";

function TimeSelect({
  label,
  value,
  disabled,
  formatMinute,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  formatMinute: (minute: number) => string;
  onChange: (minute: number) => void;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) =>
          onChange(Number(event.target.value))
        }
        disabled={disabled}
        className={timeSelectClassName}
      >
        {TIME_OPTIONS.map((minute) => (
          <option key={minute} value={minute}>
            {formatMinute(minute)}
          </option>
        ))}
      </select>
    </label>
  );
}

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
  const t = useTranslations(
    "TeacherAvailability",
  );

  const activeRules = rules.filter(
    (rule) => rule.isActive,
  );
  const activeDays = new Set(
    activeRules.map((rule) => rule.weekday),
  ).size;
  const weeklyMinutes = activeRules.reduce(
    (total, rule) =>
      total +
      Math.max(
        0,
        rule.endMinute - rule.startMinute,
      ),
    0,
  );

  const summary = [
    {
      label: t("summaryDays"),
      value: activeDays,
    },
    {
      label: t("summaryHours"),
      value:
        Math.round((weeklyMinutes / 60) * 10) /
        10,
    },
    {
      label: t("summaryWindows"),
      value: activeRules.length,
    },
  ];

  return (
    <section aria-labelledby="weekly-availability-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3
            id="weekly-availability-heading"
            className="text-lg font-semibold tracking-tight text-zinc-950 sm:text-xl"
          >
            {t("weeklyTitle")}
          </h3>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-zinc-600">
            {t("weeklyDescription")}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={
              !dirty ||
              disabled
            }
            className="min-h-10 rounded-xl px-4 text-sm font-semibold text-zinc-600 transition hover:bg-[#fff4ed] hover:text-[#9a3412] disabled:cursor-not-allowed disabled:opacity-40"
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
            className="min-h-10 rounded-xl bg-[#c2410c] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-14px_rgba(194,65,12,0.9)] transition hover:bg-[#9a3412] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {saving
              ? t("savingWeekly")
              : t("saveWeekly")}
          </button>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2">
        {summary.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[#edddd4] bg-[#fffaf6] px-3 py-2.5"
          >
            <dt className="text-xs font-medium text-zinc-500">
              {item.label}
            </dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-950">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      {dirty ? (
        <p
          role="status"
          className="mt-4 rounded-xl bg-[#fff4ed] px-3 py-2 text-xs font-medium text-[#9a3412]"
        >
          {t("unsavedChanges")}
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-900"
        >
          {error}
        </div>
      ) : null}

      <ul className="mt-5 divide-y divide-[#f3e7df] overflow-hidden rounded-2xl border border-[#edddd4] bg-white">
        {BOOKING_WEEKDAYS.map(
          (weekday) => {
            const dayRules =
              rules.filter(
                (rule) =>
                  rule.weekday ===
                  weekday,
              );
            const dayHasActive = dayRules.some(
              (rule) => rule.isActive,
            );

            return (
              <li
                key={weekday}
                className="grid gap-3 px-4 py-3.5 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2 rounded-full",
                      dayHasActive
                        ? "bg-[#c2410c]"
                        : "bg-zinc-300",
                    )}
                  />
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-950">
                      {t(
                        `weekdays.${weekday}`,
                      )}
                    </h4>
                    <p className="text-xs text-zinc-500">
                      {dayRules.length === 0
                        ? t("noWeeklyWindows")
                        : t("weeklyWindowCount", {
                            count:
                              dayRules.length,
                          })}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {dayRules.map(
                    (rule, index) => (
                      <fieldset
                        key={rule.key}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-xl border px-1.5 py-1 transition",
                          rule.isActive
                            ? "border-[#f5c9ad] bg-[#fff4ed]"
                            : "border-zinc-200 bg-zinc-50 opacity-70",
                        )}
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

                        <div
                          className="inline-flex items-center gap-1"
                          dir="ltr"
                        >
                          <TimeSelect
                            label={t("startTime")}
                            value={rule.startMinute}
                            disabled={disabled}
                            formatMinute={formatMinute}
                            onChange={(startMinute) =>
                              onUpdate(rule.key, {
                                startMinute,
                              })
                            }
                          />
                          <span
                            aria-hidden="true"
                            className="text-zinc-400"
                          >
                            –
                          </span>
                          <TimeSelect
                            label={t("endTime")}
                            value={rule.endMinute}
                            disabled={disabled}
                            formatMinute={formatMinute}
                            onChange={(endMinute) =>
                              onUpdate(rule.key, {
                                endMinute,
                              })
                            }
                          />
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={rule.isActive}
                          aria-label={t("active")}
                          onClick={() =>
                            onUpdate(
                              rule.key,
                              {
                                isActive:
                                  !rule.isActive,
                              },
                            )
                          }
                          disabled={disabled}
                          className={cn(
                            "relative ms-1 h-5 w-9 shrink-0 rounded-full transition disabled:opacity-50",
                            rule.isActive
                              ? "bg-[#c2410c]"
                              : "bg-zinc-300",
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
                              rule.isActive
                                ? "start-[1.125rem]"
                                : "start-0.5",
                            )}
                          />
                        </button>

                        <button
                          type="button"
                          aria-label={t("removeWindow")}
                          title={t("removeWindow")}
                          onClick={() =>
                            onRemove(
                              rule.key,
                            )
                          }
                          disabled={disabled}
                          className="grid size-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white hover:text-red-700 disabled:opacity-50"
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      </fieldset>
                    ),
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onAdd(weekday)
                  }
                  disabled={disabled}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 justify-self-start rounded-xl border border-dashed border-[#e7c9b6] px-3 text-xs font-semibold text-[#9a3412] transition hover:border-[#c2410c] hover:bg-[#fff4ed] disabled:cursor-not-allowed disabled:opacity-50 sm:justify-self-end"
                >
                  <PlusIcon className="size-4" />
                  {t("addWindow")}
                </button>
              </li>
            );
          },
        )}
      </ul>

      <p className="mt-3 text-xs leading-5 text-zinc-500">
        {t("replacementNotice")}
      </p>
    </section>
  );
}
