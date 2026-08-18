"use client";

import {
  useLocale,
  useTranslations,
} from "next-intl";

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
  const locale = useLocale();
  const t = useTranslations(
    "TeacherAvailability",
  );

  return (
    <section
      aria-labelledby="availability-exceptions-heading"
      className="xl:border-s xl:border-zinc-200 xl:ps-8"
    >
      <p
        className={[
          "text-xs font-bold text-zinc-400",
          locale === "fa"
            ? "tracking-normal"
            : "uppercase tracking-[0.16em]",
        ].join(" ")}
      >
        {t("exceptionsEyebrow")}
      </p>
      <h3
        id="availability-exceptions-heading"
        className="mt-2 text-xl font-semibold text-zinc-950 sm:text-2xl"
      >
        {t("exceptionsTitle")}
      </h3>
      <p className="mt-2 text-sm leading-7 text-zinc-600">
        {t("exceptionsDescription")}
      </p>

      <form
        className="mt-5 rounded-3xl border border-zinc-200 bg-zinc-50 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate();
        }}
      >
        {weeklyDirty ? (
          <div
            role="status"
            className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950"
          >
            {t("finishWeeklyFirst")}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-zinc-700 sm:col-span-2">
            {t("exceptionType")}
            <select
              value={draft.type}
              onChange={(event) =>
                onDraftChange({
                  type:
                    event.target.value as AvailabilityExceptionType,
                })
              }
              disabled={
                busy ||
                weeklyDirty
              }
              className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 disabled:opacity-60"
            >
              <option value="UNAVAILABLE">
                {t("unavailable")}
              </option>
              <option value="AVAILABLE">
                {t("available")}
              </option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-zinc-700 sm:col-span-2">
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
              disabled={
                busy ||
                weeklyDirty
              }
              className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 disabled:opacity-60"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-zinc-700">
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
              disabled={
                busy ||
                weeklyDirty
              }
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
              value={draft.endMinute}
              onChange={(event) =>
                onDraftChange({
                  endMinute:
                    Number(
                      event.target.value,
                    ),
                })
              }
              disabled={
                busy ||
                weeklyDirty
              }
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

          <label className="grid gap-2 text-sm font-medium text-zinc-700 sm:col-span-2">
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
              rows={3}
              disabled={
                busy ||
                weeklyDirty
              }
              placeholder={
                t("notePlaceholder")
              }
              className="resize-y rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 disabled:opacity-60"
            />
          </label>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-7 text-red-900"
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={
            busy ||
            weeklyDirty
          }
          className="mt-4 w-full rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating
            ? t("creatingException")
            : t("createException")}
        </button>
      </form>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-semibold text-zinc-950">
            {t("currentExceptions")}
          </h4>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
            {exceptions.length}
          </span>
        </div>

        {exceptions.length === 0 ? (
          <div className="mt-3 rounded-3xl border border-dashed border-zinc-300 p-5 text-sm leading-7 text-zinc-500">
            {t("noExceptions")}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {exceptions.map(
              (exception) => (
                <article
                  key={exception.id}
                  className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
                          exception.type ===
                          "UNAVAILABLE"
                            ? "bg-red-50 text-red-800"
                            : "bg-emerald-50 text-emerald-800",
                        ].join(" ")}
                      >
                        {exception.type ===
                        "UNAVAILABLE"
                          ? t("unavailable")
                          : t("available")}
                      </span>
                      <p className="mt-3 font-semibold text-zinc-950">
                        {formatDate(
                          exception.date,
                        )}
                      </p>
                      <p
                        className="mt-1 text-sm text-zinc-600"
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
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onDelete(
                          exception.id,
                        )
                      }
                      disabled={
                        busy ||
                        weeklyDirty
                      }
                      className="rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-800 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingExceptionId ===
                      exception.id
                        ? t("deletingException")
                        : t("deleteException")}
                    </button>
                  </div>

                  {exception.note ? (
                    <p className="mt-3 rounded-2xl bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-600">
                      {exception.note}
                    </p>
                  ) : null}
                </article>
              ),
            )}
          </div>
        )}
      </div>

      <p className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs leading-6 text-sky-950">
        {t("precedenceNotice")}
      </p>
    </section>
  );
}
