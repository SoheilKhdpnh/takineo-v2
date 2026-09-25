"use client";

import { useTranslations } from "next-intl";

import type {
  AvailabilityExceptionType,
} from "@/lib/domain/booking";
import {
  BOOKING_MAX_EXCEPTION_NOTE_LENGTH,
  BOOKING_SLOT_MINUTES,
} from "@/lib/domain/booking-policy";
import type {
  TeacherAvailabilityException,
  TeacherAvailabilityReadRange,
} from "@/components/availability/teacher-availability-api";
import { TrashIcon } from "@/components/ui/WorkspaceIcons";
import { cn } from "@/lib/ui/cn";

export type ExceptionDraft = {
  date: string;
  startMinute: number;
  endMinute: number;
  type: AvailabilityExceptionType;
  note: string;
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

const EXCEPTION_TYPES: AvailabilityExceptionType[] = [
  "UNAVAILABLE",
  "AVAILABLE",
];

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-[#edddd4] bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-[#c2410c] focus:ring-2 focus:ring-[#c2410c]/15 disabled:opacity-60";

interface AvailabilityExceptionsEditorProps {
  exceptions: TeacherAvailabilityException[];
  draft: ExceptionDraft;
  range: TeacherAvailabilityReadRange;
  weeklyDirty: boolean;
  busy: boolean;
  creating: boolean;
  deletingExceptionId: string | null;
  error: string | null;
  formatDate: (dateKey: string) => string;
  formatMinute: (minute: number) => string;
  onDraftChange: (
    patch: Partial<ExceptionDraft>,
  ) => void;
  onCreate: () => void;
  onDelete: (exceptionId: string) => void;
}

export function AvailabilityExceptionsEditor({
  exceptions,
  draft,
  range,
  weeklyDirty,
  busy,
  creating,
  deletingExceptionId,
  error,
  formatDate,
  formatMinute,
  onDraftChange,
  onCreate,
  onDelete,
}: AvailabilityExceptionsEditorProps) {
  const t = useTranslations(
    "TeacherAvailability",
  );
  const formDisabled = busy || weeklyDirty;

  return (
    <section
      aria-labelledby="availability-exceptions-heading"
      className="rounded-2xl border border-[#edddd4] bg-[#fffaf6] p-5"
    >
      <h3
        id="availability-exceptions-heading"
        className="text-lg font-semibold tracking-tight text-zinc-950"
      >
        {t("exceptionsTitle")}
      </h3>
      <p className="mt-1.5 text-sm leading-6 text-zinc-600">
        {t("exceptionsDescription")}
      </p>

      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate();
        }}
      >
        {weeklyDirty ? (
          <div
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"
          >
            {t("finishWeeklyFirst")}
          </div>
        ) : null}

        <div
          role="group"
          aria-label={t("exceptionType")}
          className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1 ring-1 ring-[#edddd4]"
        >
          {EXCEPTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={draft.type === type}
              onClick={() => onDraftChange({ type })}
              disabled={formDisabled}
              className={cn(
                "min-h-9 rounded-lg text-sm font-semibold transition disabled:opacity-60",
                draft.type === type
                  ? "bg-[#c2410c] text-white shadow-sm"
                  : "text-zinc-600 hover:bg-[#fff4ed] hover:text-[#9a3412]",
              )}
            >
              {type === "UNAVAILABLE"
                ? t("unavailable")
                : t("available")}
            </button>
          ))}
        </div>

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          {t("exceptionDate")}
          <input
            type="date"
            value={draft.date}
            min={range.fromDate}
            max={range.toDate}
            onChange={(event) =>
              onDraftChange({
                date:
                  event.target.value,
              })
            }
            required
            disabled={formDisabled}
            className={fieldClassName}
          />
        </label>

        <div
          className="grid grid-cols-2 gap-3"
          dir="ltr"
        >
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            {t("startTime")}
            <select
              value={draft.startMinute}
              onChange={(event) =>
                onDraftChange({
                  startMinute:
                    Number(
                      event.target.value,
                    ),
                })
              }
              disabled={formDisabled}
              className={cn(fieldClassName, "tabular-nums")}
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

          <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
            {t("endTime")}
            <select
              value={draft.endMinute}
              onChange={(event) =>
                onDraftChange({
                  endMinute:
                    Number(
                      event.target.value,
                    ),
                })
              }
              disabled={formDisabled}
              className={cn(fieldClassName, "tabular-nums")}
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
        </div>

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          {t("note")}
          <textarea
            value={draft.note}
            onChange={(event) =>
              onDraftChange({
                note:
                  event.target.value,
              })
            }
            maxLength={
              BOOKING_MAX_EXCEPTION_NOTE_LENGTH
            }
            rows={2}
            disabled={formDisabled}
            placeholder={
              t("notePlaceholder")
            }
            className={cn(
              fieldClassName,
              "resize-y py-2.5 placeholder:text-zinc-400",
            )}
          />
        </label>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-900"
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={formDisabled}
          className="min-h-11 w-full rounded-xl bg-[#c2410c] px-4 text-sm font-semibold text-white transition hover:bg-[#9a3412] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating
            ? t("creatingException")
            : t("createException")}
        </button>
      </form>

      <div className="mt-6 border-t border-[#edddd4] pt-5">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-zinc-950">
            {t("currentExceptions")}
          </h4>
          <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#9a3412] ring-1 ring-[#edddd4]">
            {exceptions.length}
          </span>
        </div>

        {exceptions.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-[#e7c9b6] px-4 py-5 text-center text-sm text-zinc-500">
            {t("noExceptions")}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {exceptions.map(
              (exception) => (
                <li
                  key={exception.id}
                  className="flex items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-[#edddd4]"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1 h-9 w-1 shrink-0 rounded-full",
                      exception.type ===
                        "UNAVAILABLE"
                        ? "bg-zinc-400"
                        : "bg-[#c2410c]",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-zinc-500">
                      {exception.type ===
                      "UNAVAILABLE"
                        ? t("unavailable")
                        : t("available")}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-zinc-950">
                      {formatDate(
                        exception.date,
                      )}
                    </p>
                    <p
                      className="text-sm tabular-nums text-zinc-600"
                      dir="ltr"
                    >
                      {formatMinute(
                        exception.startMinute,
                      )}
                      {" – "}
                      {formatMinute(
                        exception.endMinute,
                      )}
                    </p>
                    {exception.note ? (
                      <p className="mt-1.5 text-xs leading-5 text-zinc-500">
                        {exception.note}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onDelete(
                        exception.id,
                      )
                    }
                    disabled={formDisabled}
                    className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-zinc-500 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <TrashIcon className="size-4" />
                    {deletingExceptionId ===
                    exception.id
                      ? t("deletingException")
                      : t("deleteException")}
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs leading-5 text-zinc-500">
        {t("precedenceNotice")}
      </p>
    </section>
  );
}
