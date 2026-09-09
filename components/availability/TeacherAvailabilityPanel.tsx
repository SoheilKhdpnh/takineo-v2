"use client";

import {
  useLocale,
  useTranslations,
} from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AvailabilityExceptionsEditor,
  type ExceptionDraft,
} from "@/components/availability/AvailabilityExceptionsEditor";
import {
  createTeacherAvailabilityException,
  deleteTeacherAvailabilityException,
  getTeacherAvailability,
  getTeacherAvailabilityReadRange,
  replaceTeacherAvailability,
  TeacherAvailabilityApiError,
  type TeacherAvailabilityExceptionInput,
  type TeacherAvailabilityRuleInput,
  type TeacherAvailabilitySnapshot,
} from "@/components/availability/teacher-availability-api";
import {
  WeeklyAvailabilityEditor,
  type WeeklyDraftRule,
} from "@/components/availability/WeeklyAvailabilityEditor";
import type {
  BookingWeekday,
} from "@/lib/domain/booking";
import {
  BOOKING_OPERATIONAL_TIMEZONE,
} from "@/lib/domain/booking-policy";
import {
  iranLocalDateMinuteToInstant,
} from "@/lib/time/iran-booking-time";
import {
  useRouter,
} from "@/i18n/navigation";

type LoadState =
  | "loading"
  | "ready"
  | "error"
  | "locked";

type AvailabilityErrorTranslationKey =
  | "errors.network"
  | "errors.invalidResponse"
  | "errors.invalidRequest"
  | "errors.range"
  | "errors.security"
  | "errors.unavailable"
  | "errors.exceptionNotFound"
  | "errors.conflict"
  | "errors.generic";

const DEFAULT_START_MINUTE = 9 * 60;
const DEFAULT_END_MINUTE = 10 * 60;

function toRuleInput(
  rule: WeeklyDraftRule,
): TeacherAvailabilityRuleInput {
  return {
    weekday: rule.weekday,
    startMinute: rule.startMinute,
    endMinute: rule.endMinute,
    isActive: rule.isActive,
  };
}

function toDraftRules(
  snapshot: TeacherAvailabilitySnapshot,
): WeeklyDraftRule[] {
  return snapshot.rules.map(
    (rule) => ({
      key: rule.id,
      weekday: rule.weekday,
      startMinute: rule.startMinute,
      endMinute: rule.endMinute,
      isActive: rule.isActive,
    }),
  );
}

function sameRuleInputs(
  first: TeacherAvailabilityRuleInput[],
  second: TeacherAvailabilityRuleInput[],
): boolean {
  if (
    first.length !==
    second.length
  ) {
    return false;
  }

  return first.every(
    (rule, index) => {
      const other = second[index];

      return (
        other !== undefined &&
        rule.weekday === other.weekday &&
        rule.startMinute ===
          other.startMinute &&
        rule.endMinute ===
          other.endMinute &&
        rule.isActive === other.isActive
      );
    },
  );
}

function errorTranslationKey(
  error: unknown,
): AvailabilityErrorTranslationKey {
  if (
    !(error instanceof TeacherAvailabilityApiError)
  ) {
    return "errors.network";
  }

  if (
    error.code === null &&
    error.status >= 200 &&
    error.status < 300
  ) {
    return "errors.invalidResponse";
  }

  switch (error.code) {
    case "INVALID_REQUEST":
    case "INVALID_JSON":
      return "errors.invalidRequest";

    case "INVALID_DATE_RANGE":
    case "RANGE_TOO_LARGE":
      return "errors.range";

    case "UNTRUSTED_ORIGIN":
      return "errors.security";

    case "FORBIDDEN_PROFILE_TYPE":
    case "PROFILE_NOT_FOUND":
      return "errors.unavailable";

    case "TEACHER_AVAILABILITY_EXCEPTION_NOT_FOUND":
      return "errors.exceptionNotFound";

    case "TEACHER_AVAILABILITY_CONFLICT":
      return "errors.conflict";

    case "INTERNAL_SERVER_ERROR":
    case null:
    default:
      return "errors.generic";
  }
}

function hasErrorCode(
  error: unknown,
  code: string,
): boolean {
  return (
    error instanceof TeacherAvailabilityApiError &&
    error.code === code
  );
}

export function TeacherAvailabilityPanel() {
  const locale = useLocale();
  const {
    push,
    refresh,
  } = useRouter();
  const t = useTranslations(
    "TeacherAvailability",
  );
  const nextDraftId = useRef(0);

  const [readRange] = useState(() =>
    getTeacherAvailabilityReadRange(
      new Date(),
    ),
  );

  const [loadState, setLoadState] =
    useState<LoadState>("loading");
  const [snapshot, setSnapshot] =
    useState<TeacherAvailabilitySnapshot | null>(
      null,
    );
  const [draftRules, setDraftRules] =
    useState<WeeklyDraftRule[]>([]);
  const [weeklyError, setWeeklyError] =
    useState<string | null>(null);
  const [isSavingWeekly, setIsSavingWeekly] =
    useState(false);
  const [exceptionError, setExceptionError] =
    useState<string | null>(null);
  const [isCreatingException, setIsCreatingException] =
    useState(false);
  const [deletingExceptionId, setDeletingExceptionId] =
    useState<string | null>(null);
  const [notice, setNotice] =
    useState<string | null>(null);
  const [exceptionDraft, setExceptionDraft] =
    useState<ExceptionDraft>({
      date: readRange.fromDate,
      startMinute: DEFAULT_START_MINUTE,
      endMinute: DEFAULT_END_MINUTE,
      type: "UNAVAILABLE",
      note: "",
    });

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(
        locale === "fa"
          ? "fa-IR"
          : "en-US",
        {
          timeZone:
            BOOKING_OPERATIONAL_TIMEZONE,
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        },
      ),
    [locale],
  );

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(
        locale === "fa"
          ? "fa-IR"
          : "en-US",
        {
          minimumIntegerDigits: 2,
          useGrouping: false,
        },
      ),
    [locale],
  );

  const formatMinute = useCallback(
    (minute: number) => {
      if (minute === 1440) {
        return `${numberFormatter.format(24)}:${numberFormatter.format(0)}`;
      }

      return `${numberFormatter.format(
        Math.floor(minute / 60),
      )}:${numberFormatter.format(
        minute % 60,
      )}`;
    },
    [numberFormatter],
  );

  const formatDate = useCallback(
    (dateKey: string) =>
      dateFormatter.format(
        iranLocalDateMinuteToInstant(
          dateKey,
          0,
        ),
      ),
    [dateFormatter],
  );

  const authoritativeRuleInputs = useMemo(
    () =>
      snapshot?.rules.map(
        (rule) => ({
          weekday: rule.weekday,
          startMinute: rule.startMinute,
          endMinute: rule.endMinute,
          isActive: rule.isActive,
        }),
      ) ?? [],
    [snapshot],
  );

  const draftRuleInputs = useMemo(
    () =>
      draftRules.map(
        toRuleInput,
      ),
    [draftRules],
  );

  const weeklyDirty = !sameRuleInputs(
    authoritativeRuleInputs,
    draftRuleInputs,
  );

  const isExceptionMutating =
    isCreatingException ||
    deletingExceptionId !== null;

  const isMutating =
    isSavingWeekly ||
    isExceptionMutating;

  const applySnapshot = useCallback(
    (
      nextSnapshot:
        TeacherAvailabilitySnapshot,
    ) => {
      setSnapshot(nextSnapshot);
      setDraftRules(
        toDraftRules(nextSnapshot),
      );
      setLoadState("ready");
    },
    [],
  );

  const redirectToSignIn = useCallback(
    () => {
      push("/sign-in");
      refresh();
    },
    [push, refresh],
  );

  const loadAuthoritativeSnapshot = useCallback(
    async (
      signal?: AbortSignal,
    ) => {
      const nextSnapshot =
        await getTeacherAvailability(
          readRange,
          signal,
        );

      applySnapshot(nextSnapshot);
    },
    [applySnapshot, readRange],
  );

  const lockEditor = useCallback(
    () => {
      setSnapshot(null);
      setDraftRules([]);
      setLoadState("locked");
    },
    [],
  );

  const handleLoadFailure = useCallback(
    (error: unknown) => {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      if (
        hasErrorCode(
          error,
          "UNAUTHORIZED",
        )
      ) {
        redirectToSignIn();
        return;
      }

      if (
        hasErrorCode(
          error,
          "TEACHER_AVAILABILITY_STATE_CONFLICT",
        )
      ) {
        lockEditor();
        return;
      }

      setLoadState("error");
    },
    [lockEditor, redirectToSignIn],
  );

  useEffect(() => {
    const controller =
      new AbortController();

    void Promise.resolve().then(
      async () => {
        if (controller.signal.aborted) {
          return;
        }

        try {
          await loadAuthoritativeSnapshot(
            controller.signal,
          );
        } catch (error) {
          handleLoadFailure(error);
        }
      },
    );

    return () => {
      controller.abort();
    };
  }, [
    handleLoadFailure,
    loadAuthoritativeSnapshot,
  ]);

  async function refetchAfterMutation(): Promise<boolean> {
    try {
      await loadAuthoritativeSnapshot();
      return true;
    } catch (error) {
      if (
        hasErrorCode(
          error,
          "UNAUTHORIZED",
        )
      ) {
        redirectToSignIn();
        return false;
      }

      if (
        hasErrorCode(
          error,
          "TEACHER_AVAILABILITY_STATE_CONFLICT",
        )
      ) {
        lockEditor();
        return false;
      }

      return false;
    }
  }

  function addWeeklyWindow(
    weekday: BookingWeekday,
  ) {
    nextDraftId.current += 1;

    setDraftRules((current) => [
      ...current,
      {
        key:
          `new-${nextDraftId.current}`,
        weekday,
        startMinute:
          DEFAULT_START_MINUTE,
        endMinute:
          DEFAULT_END_MINUTE,
        isActive: true,
      },
    ]);

    setWeeklyError(null);
    setNotice(null);
  }

  function updateWeeklyRule(
    key: string,
    patch: Partial<TeacherAvailabilityRuleInput>,
  ) {
    setDraftRules((current) =>
      current.map((rule) =>
        rule.key === key
          ? {
              ...rule,
              ...patch,
            }
          : rule,
      ),
    );

    setWeeklyError(null);
    setNotice(null);
  }

  function removeWeeklyRule(
    key: string,
  ) {
    setDraftRules((current) =>
      current.filter(
        (rule) => rule.key !== key,
      ),
    );

    setWeeklyError(null);
    setNotice(null);
  }

  function resetWeeklyDraft() {
    if (!snapshot) {
      return;
    }

    setDraftRules(
      toDraftRules(snapshot),
    );
    setWeeklyError(null);
    setNotice(null);
  }

  function updateExceptionDraft(
    patch: Partial<ExceptionDraft>,
  ) {
    setExceptionDraft((current) => ({
      ...current,
      ...patch,
    }));
    setExceptionError(null);
    setNotice(null);
  }

  function handleMutationAccessError(
    error: unknown,
  ): boolean {
    if (
      hasErrorCode(
        error,
        "UNAUTHORIZED",
      )
    ) {
      redirectToSignIn();
      return true;
    }

    if (
      hasErrorCode(
        error,
        "TEACHER_AVAILABILITY_STATE_CONFLICT",
      )
    ) {
      lockEditor();
      return true;
    }

    return false;
  }

  async function saveWeeklySchedule() {
    if (
      isMutating ||
      loadState !== "ready"
    ) {
      return;
    }

    setIsSavingWeekly(true);
    setWeeklyError(null);
    setNotice(null);

    try {
      await replaceTeacherAvailability(
        draftRuleInputs,
      );

      const refreshed =
        await refetchAfterMutation();

      if (refreshed) {
        setNotice(
          t("weeklySaveSuccess"),
        );
      } else {
        setWeeklyError(
          t("errors.refreshFailed"),
        );
      }
    } catch (error) {
      if (
        handleMutationAccessError(
          error,
        )
      ) {
        return;
      }

      setWeeklyError(
        t(errorTranslationKey(error)),
      );

      if (
        hasErrorCode(
          error,
          "TEACHER_AVAILABILITY_CONFLICT",
        )
      ) {
        const refreshed =
          await refetchAfterMutation();

        if (!refreshed) {
          setWeeklyError(
            t("errors.refreshFailed"),
          );
        }
      }
    } finally {
      setIsSavingWeekly(false);
    }
  }

  async function createException() {
    if (
      isMutating ||
      weeklyDirty ||
      loadState !== "ready"
    ) {
      return;
    }

    setIsCreatingException(true);
    setExceptionError(null);
    setNotice(null);

    const note =
      exceptionDraft.note.trim();

    const input:
      TeacherAvailabilityExceptionInput = {
        date: exceptionDraft.date,
        startMinute:
          exceptionDraft.startMinute,
        endMinute:
          exceptionDraft.endMinute,
        type: exceptionDraft.type,
        ...(note.length > 0
          ? { note }
          : {}),
      };

    try {
      await createTeacherAvailabilityException(
        input,
      );

      const refreshed =
        await refetchAfterMutation();

      if (refreshed) {
        setExceptionDraft((current) => ({
          ...current,
          note: "",
        }));
        setNotice(
          t("exceptionCreateSuccess"),
        );
      } else {
        setExceptionError(
          t("errors.refreshFailed"),
        );
      }
    } catch (error) {
      if (
        handleMutationAccessError(
          error,
        )
      ) {
        return;
      }

      setExceptionError(
        t(errorTranslationKey(error)),
      );

      if (
        hasErrorCode(
          error,
          "TEACHER_AVAILABILITY_CONFLICT",
        )
      ) {
        const refreshed =
          await refetchAfterMutation();

        if (!refreshed) {
          setExceptionError(
            t("errors.refreshFailed"),
          );
        }
      }
    } finally {
      setIsCreatingException(false);
    }
  }

  async function deleteException(
    exceptionId: string,
  ) {
    if (
      isMutating ||
      weeklyDirty ||
      loadState !== "ready"
    ) {
      return;
    }

    setDeletingExceptionId(
      exceptionId,
    );
    setExceptionError(null);
    setNotice(null);

    try {
      await deleteTeacherAvailabilityException(
        exceptionId,
      );

      const refreshed =
        await refetchAfterMutation();

      if (refreshed) {
        setNotice(
          t("exceptionDeleteSuccess"),
        );
      } else {
        setExceptionError(
          t("errors.refreshFailed"),
        );
      }
    } catch (error) {
      if (
        handleMutationAccessError(
          error,
        )
      ) {
        return;
      }

      setExceptionError(
        t(errorTranslationKey(error)),
      );

      if (
        hasErrorCode(
          error,
          "TEACHER_AVAILABILITY_CONFLICT",
        ) ||
        hasErrorCode(
          error,
          "TEACHER_AVAILABILITY_EXCEPTION_NOT_FOUND",
        )
      ) {
        const refreshed =
          await refetchAfterMutation();

        if (!refreshed) {
          setExceptionError(
            t("errors.refreshFailed"),
          );
        }
      }
    } finally {
      setDeletingExceptionId(null);
    }
  }

  const panelHeader = (
    <header className="border-b border-zinc-800 bg-[radial-gradient(circle_at_top_left,rgba(244,244,245,0.16),transparent_32%),linear-gradient(135deg,#09090b_0%,#18181b_58%,#27272a_100%)] px-5 py-7 text-white sm:px-8 sm:py-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p
            className={[
              "text-xs font-bold text-zinc-400",
              locale === "fa"
                ? "tracking-normal"
                : "uppercase tracking-[0.18em]",
            ].join(" ")}
          >
            {t("eyebrow")}
          </p>
          <h2
            id="teacher-availability-heading"
            className="mt-2 text-2xl font-semibold sm:text-3xl"
          >
            {t("title")}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">
            {t("description")}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300 backdrop-blur">
          <p className="font-semibold text-white">
            {t("tehranTime")}
          </p>
          <p className="mt-1 leading-6">
            {t("window", {
              from: formatDate(
                readRange.fromDate,
              ),
              to: formatDate(
                readRange.toDate,
              ),
            })}
          </p>
        </div>
      </div>
    </header>
  );

  if (loadState === "loading") {
    return (
      <section
        aria-busy="true"
        aria-labelledby="teacher-availability-heading"
        className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white shadow-[0_28px_80px_-42px_rgba(24,24,27,0.35)]"
      >
        {panelHeader}
        <p
          className="sr-only"
          role="status"
        >
          {t("loading")}
        </p>
        <div className="grid gap-4 p-5 sm:p-8 lg:grid-cols-2">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="animate-pulse rounded-3xl border border-zinc-100 bg-zinc-50 p-6"
            >
              <div className="h-5 w-40 rounded-full bg-zinc-200" />
              <div className="mt-5 h-24 rounded-2xl bg-zinc-200/80" />
              <div className="mt-3 h-24 rounded-2xl bg-zinc-200/70" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (loadState === "locked") {
    return (
      <section
        aria-labelledby="teacher-availability-heading"
        className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white shadow-[0_28px_80px_-42px_rgba(24,24,27,0.35)]"
      >
        {panelHeader}
        <div className="p-5 sm:p-8">
          <div
            role="status"
            className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950"
          >
            <p className="text-lg font-semibold">
              {t("lockedTitle")}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-amber-900">
              {t("lockedDescription")}
            </p>
            <button
              type="button"
              onClick={() => {
                setLoadState("loading");
                setNotice(null);
                void loadAuthoritativeSnapshot().catch(
                  handleLoadFailure,
                );
              }}
              className="mt-5 rounded-full bg-amber-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-950"
            >
              {t("checkAgain")}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (
    loadState === "error" ||
    snapshot === null
  ) {
    return (
      <section
        aria-labelledby="teacher-availability-heading"
        className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white shadow-[0_28px_80px_-42px_rgba(24,24,27,0.35)]"
      >
        {panelHeader}
        <div className="p-5 sm:p-8">
          <div
            role="alert"
            className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-950"
          >
            <p className="text-lg font-semibold">
              {t("loadErrorTitle")}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-red-800">
              {t("loadErrorDescription")}
            </p>
            <button
              type="button"
              onClick={() => {
                setLoadState("loading");
                setNotice(null);
                void loadAuthoritativeSnapshot().catch(
                  handleLoadFailure,
                );
              }}
              className="mt-5 rounded-full bg-red-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-950"
            >
              {t("tryAgain")}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="teacher-availability-heading"
      className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white shadow-[0_28px_80px_-42px_rgba(24,24,27,0.35)]"
    >
      {panelHeader}

      {notice ? (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-950 sm:px-8"
        >
          {notice}
        </div>
      ) : null}

      <div className="grid gap-8 p-5 sm:p-8 xl:grid-cols-[1.3fr_0.9fr]">
        <WeeklyAvailabilityEditor
          rules={draftRules}
          dirty={weeklyDirty}
          disabled={isMutating}
          saving={isSavingWeekly}
          error={weeklyError}
          formatMinute={formatMinute}
          onAdd={addWeeklyWindow}
          onUpdate={updateWeeklyRule}
          onRemove={removeWeeklyRule}
          onReset={resetWeeklyDraft}
          onSave={() =>
            void saveWeeklySchedule()
          }
        />

        <AvailabilityExceptionsEditor
          exceptions={snapshot.exceptions}
          draft={exceptionDraft}
          range={readRange}
          weeklyDirty={weeklyDirty}
          busy={isMutating}
          creating={isCreatingException}
          deletingExceptionId={
            deletingExceptionId
          }
          error={exceptionError}
          formatDate={formatDate}
          formatMinute={formatMinute}
          onDraftChange={updateExceptionDraft}
          onCreate={() =>
            void createException()
          }
          onDelete={(exceptionId) =>
            void deleteException(
              exceptionId,
            )
          }
        />
      </div>
    </section>
  );
}
