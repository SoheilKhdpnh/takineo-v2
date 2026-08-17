"use client";

import {
  useLocale,
  useTranslations,
} from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  parseSessionApiError,
  parseSessionCancellationSuccess,
  parseSessionListResponse,
  type SessionListItem,
  type SessionViewerRole,
} from "@/components/sessions/session-api";
import {
  useRouter,
} from "@/i18n/navigation";
import {
  BOOKING_MAX_CANCELLATION_REASON_LENGTH,
  BOOKING_OPERATIONAL_TIMEZONE,
} from "@/lib/domain/booking-policy";

interface UpcomingSessionsPanelProps {
  viewerRole: SessionViewerRole;
}

type LoadState =
  | "loading"
  | "ready"
  | "error";

const PAGE_LIMIT = 20;

function mergeUniqueSessions(
  current: SessionListItem[],
  incoming: SessionListItem[],
): SessionListItem[] {
  const byId = new Map(
    current.map((session) => [
      session.id,
      session,
    ]),
  );

  for (const session of incoming) {
    byId.set(
      session.id,
      session,
    );
  }

  return Array.from(
    byId.values(),
  );
}

function getInitials(
  name: string,
): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "T";
  }

  return parts
    .map((part) =>
      Array.from(part)[0] ?? "",
    )
    .join("")
    .toUpperCase();
}

async function readJson(
  response: Response,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function UpcomingSessionsPanel({
  viewerRole,
}: UpcomingSessionsPanelProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations(
    "UpcomingSessions",
  );

  const [sessions, setSessions] =
    useState<SessionListItem[]>([]);
  const [hasMore, setHasMore] =
    useState(false);
  const [nextCursor, setNextCursor] =
    useState<string | null>(null);
  const [loadState, setLoadState] =
    useState<LoadState>("loading");
  const [isLoadingMore, setIsLoadingMore] =
    useState(false);
  const [activeCancelId, setActiveCancelId] =
    useState<string | null>(null);
  const [reason, setReason] =
    useState("");
  const [cancelError, setCancelError] =
    useState<string | null>(null);
  const [isCancelling, setIsCancelling] =
    useState(false);
  const [notice, setNotice] =
    useState<string | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(
        locale === "fa" ? "fa-IR" : "en-US",
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

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(
        locale === "fa" ? "fa-IR" : "en-US",
        {
          timeZone:
            BOOKING_OPERATIONAL_TIMEZONE,
          hour: "2-digit",
          minute: "2-digit",
        },
      ),
    [locale],
  );

  const fetchPage = useCallback(
    async (
      cursor: string | null,
      signal?: AbortSignal,
    ) => {
      const params =
        new URLSearchParams({
          bucket: "upcoming",
          limit: String(PAGE_LIMIT),
        });

      if (cursor) {
        params.set(
          "cursor",
          cursor,
        );
      }

      const response = await fetch(
        `/api/sessions?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
          signal,
        },
      );

      if (response.status === 401) {
        router.push("/sign-in");
        router.refresh();
        return null;
      }

      if (!response.ok) {
        throw new Error(
          "SESSION_LIST_REQUEST_FAILED",
        );
      }

      const parsed =
        parseSessionListResponse(
          await readJson(response),
        );

      if (!parsed) {
        throw new Error(
          "SESSION_LIST_RESPONSE_INVALID",
        );
      }

      return parsed;
    },
    [router],
  );

  const loadInitial = useCallback(
    async (
      signal?: AbortSignal,
    ) => {
      try {
        const result =
          await fetchPage(
            null,
            signal,
          );

        if (!result) {
          return;
        }

        setSessions(result.items);
        setHasMore(result.hasMore);
        setNextCursor(
          result.nextCursor,
        );
        setLoadState("ready");
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setLoadState("error");
      }
    },
    [fetchPage],
  );

  useEffect(() => {
    const controller =
      new AbortController();

    void Promise.resolve().then(() =>
      loadInitial(
        controller.signal,
      ),
    );

    return () => {
      controller.abort();
    };
  }, [loadInitial]);

  async function handleLoadMore() {
    if (
      !nextCursor ||
      isLoadingMore
    ) {
      return;
    }

    setIsLoadingMore(true);
    setNotice(null);

    try {
      const result =
        await fetchPage(
          nextCursor,
        );

      if (!result) {
        return;
      }

      setSessions((current) =>
        mergeUniqueSessions(
          current,
          result.items,
        ),
      );
      setHasMore(result.hasMore);
      setNextCursor(
        result.nextCursor,
      );
    } catch {
      setNotice(
        t("loadMoreError"),
      );
    } finally {
      setIsLoadingMore(false);
    }
  }

  function openCancellation(
    sessionId: string,
  ) {
    setActiveCancelId(
      sessionId,
    );
    setReason("");
    setCancelError(null);
    setNotice(null);
  }

  function closeCancellation() {
    if (isCancelling) {
      return;
    }

    setActiveCancelId(null);
    setReason("");
    setCancelError(null);
  }

  function cancellationErrorMessage(
    error: string | undefined,
    state: string | undefined,
  ): string {
    switch (error) {
      case "CANCELLATION_CUTOFF":
        return t("errors.cutoff");
      case "SESSION_STATE_CONFLICT":
        return state === "STARTED"
          ? t("errors.started")
          : t("errors.stateChanged");
      case "SESSION_CANCELLATION_CONFLICT":
        return t("errors.conflict");
      case "SESSION_NOT_FOUND":
        return t("errors.stale");
      case "SESSION_CANCELLATION_FORBIDDEN":
        return t("errors.forbidden");
      case "INVALID_REQUEST":
        return t("errors.invalidRequest");
      default:
        return t("errors.generic");
    }
  }

  async function handleCancel(
    sessionId: string,
  ) {
    if (isCancelling) {
      return;
    }

    const normalizedReason =
      reason.trim();

    if (
      viewerRole === "TEACHER" &&
      normalizedReason.length === 0
    ) {
      setCancelError(
        t("reasonRequired"),
      );
      return;
    }

    setCancelError(null);
    setIsCancelling(true);

    const body =
      normalizedReason.length > 0
        ? {
            reason:
              normalizedReason,
          }
        : {};

    try {
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(sessionId)}/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      if (response.status === 401) {
        router.push("/sign-in");
        router.refresh();
        return;
      }

      const responseBody =
        await readJson(response);

      if (!response.ok) {
        const apiError =
          parseSessionApiError(
            responseBody,
          );

        setCancelError(
          cancellationErrorMessage(
            apiError.error,
            apiError.state,
          ),
        );
        return;
      }

      const cancellationResult =
        parseSessionCancellationSuccess(
          responseBody,
        );

      if (
        !cancellationResult ||
        cancellationResult.session.id !==
          sessionId ||
        cancellationResult.cancellation.sessionId !==
          sessionId
      ) {
        setCancelError(
          t("errors.invalidResponse"),
        );
        return;
      }

      setSessions((current) =>
        current.filter(
          (session) =>
            session.id !== sessionId,
        ),
      );
      setActiveCancelId(null);
      setReason("");
      setNotice(
        t("cancelSuccess"),
      );
    } catch {
      setCancelError(
        t("errors.network"),
      );
    } finally {
      setIsCancelling(false);
    }
  }

  const sessionPanelHeader = (
    <header className="border-b border-zinc-100 bg-[linear-gradient(135deg,#fafafa_0%,#ffffff_55%,#f4f4f5_100%)] px-5 py-6 sm:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
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
            id="upcoming-sessions-heading"
            className="mt-2 text-2xl font-semibold text-zinc-950 sm:text-3xl"
          >
            {t("title")}
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-7 text-zinc-500 sm:text-end">
          {t("description")}
        </p>
      </div>
    </header>
  );

  if (loadState === "loading") {
    return (
      <section
        aria-busy="true"
        aria-labelledby="upcoming-sessions-heading"
        className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white shadow-[0_24px_70px_-40px_rgba(24,24,27,0.3)]"
      >
        {sessionPanelHeader}

        <p className="sr-only" role="status">
          {t("loading")}
        </p>

        <div className="grid gap-3 p-5 sm:p-7">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="animate-pulse rounded-3xl border border-zinc-100 bg-zinc-50 p-5"
            >
              <div className="h-4 w-28 rounded-full bg-zinc-200" />
              <div className="mt-4 h-6 w-2/3 rounded-full bg-zinc-200" />
              <div className="mt-3 h-4 w-1/2 rounded-full bg-zinc-200" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (loadState === "error") {
    return (
      <section
        aria-labelledby="upcoming-sessions-heading"
        className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white shadow-[0_24px_70px_-40px_rgba(24,24,27,0.3)]"
      >
        {sessionPanelHeader}

        <div className="p-5 sm:p-7">
          <div
            role="alert"
            className="rounded-3xl border border-red-100 bg-red-50 p-5 text-red-950"
          >
            <p className="font-semibold">
              {t("loadErrorTitle")}
            </p>
            <p className="mt-2 text-sm leading-7 text-red-800">
              {t("loadErrorDescription")}
            </p>
            <button
              type="button"
              onClick={() => {
                setLoadState("loading");
                setNotice(null);
                void loadInitial();
              }}
              className="mt-4 rounded-full bg-red-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-950"
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
      aria-labelledby="upcoming-sessions-heading"
      className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white shadow-[0_24px_70px_-40px_rgba(24,24,27,0.3)]"
    >
      {sessionPanelHeader}

      <div className="p-5 sm:p-7">
        {notice ? (
          <p
            role="status"
            className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
          >
            {notice}
          </p>
        ) : null}

        {sessions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/70 px-6 py-10 text-center">
            <div
              aria-hidden="true"
              className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-zinc-950 text-lg text-white"
            >
              {locale === "fa"
                ? "۱۵"
                : "15"}
            </div>
            <h3 className="mt-5 text-lg font-semibold text-zinc-950">
              {t("emptyTitle")}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-zinc-600">
              {t("emptyDescription")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => {
              const counterparty =
                session.counterparty;
              const expectedCounterparty =
                viewerRole === "STUDENT"
                  ? "TEACHER"
                  : "STUDENT";

              if (
                counterparty.type !==
                expectedCounterparty
              ) {
                return (
                  <div
                    key={session.id}
                    role="alert"
                    className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-900"
                  >
                    {t("invalidSessionData")}
                  </div>
                );
              }

              const start =
                new Date(
                  session.startAt,
                );
              const end =
                new Date(
                  session.endAt,
                );
              const cancelling =
                activeCancelId ===
                session.id;

              return (
                <article
                  key={session.id}
                  className="group rounded-3xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-[0_18px_45px_-32px_rgba(24,24,27,0.45)] sm:p-6"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div
                        aria-hidden="true"
                        className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-sm font-bold tracking-wide text-white"
                      >
                        {getInitials(
                          counterparty.name,
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold text-zinc-950">
                          {counterparty.name}
                        </p>

                        {counterparty.type ===
                          "TEACHER" &&
                        counterparty.headline ? (
                          <p className="mt-0.5 truncate text-sm text-zinc-500">
                            {counterparty.headline}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-sm text-zinc-500">
                            {viewerRole ===
                            "TEACHER"
                              ? t("studentLabel")
                              : t("teacherLabel")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="sm:text-end">
                      <p className="text-sm font-semibold text-zinc-950">
                        <time
                          dateTime={
                            session.startAt
                          }
                        >
                          {dateFormatter.format(
                            start,
                          )}
                        </time>
                      </p>
                      <p
                        className="mt-1 font-medium tabular-nums text-zinc-600"
                        dir="ltr"
                      >
                        <time
                          dateTime={
                            session.startAt
                          }
                        >
                          {timeFormatter.format(
                            start,
                          )}
                        </time>
                        <span
                          aria-hidden="true"
                          className="px-1.5 text-zinc-300"
                        >
                          —
                        </span>
                        <time
                          dateTime={
                            session.endAt
                          }
                        >
                          {timeFormatter.format(
                            end,
                          )}
                        </time>
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-zinc-700">
                        {t("speakingSession")}
                      </span>
                      <span className="rounded-full border border-zinc-200 px-3 py-1.5 text-zinc-500">
                        {t("tehranTime")}
                      </span>
                    </div>

                    <button
                      type="button"
                      aria-expanded={
                        cancelling
                      }
                      aria-controls={
                        cancelling
                          ? `cancel-session-${session.id}`
                          : undefined
                      }
                      onClick={() =>
                        cancelling
                          ? closeCancellation()
                          : openCancellation(
                              session.id,
                            )
                      }
                      className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-950 hover:bg-zinc-950 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                    >
                      {cancelling
                        ? t("keepSession")
                        : t("cancelAction")}
                    </button>
                  </div>

                  {cancelling ? (
                    <div
                      id={`cancel-session-${session.id}`}
                      className="mt-4 rounded-3xl border border-amber-200 bg-amber-50/70 p-5"
                    >
                      <h4 className="text-base font-semibold text-amber-950">
                        {t("cancelTitle")}
                      </h4>
                      <p className="mt-2 text-sm leading-7 text-amber-900">
                        {viewerRole ===
                        "TEACHER"
                          ? t(
                              "cancelTeacherDescription",
                            )
                          : t(
                              "cancelStudentDescription",
                            )}
                      </p>

                      <label
                        htmlFor={`cancel-reason-${session.id}`}
                        className="mt-4 block text-sm font-semibold text-amber-950"
                      >
                        {viewerRole ===
                        "TEACHER"
                          ? t("reasonRequiredLabel")
                          : t("reasonOptionalLabel")}
                      </label>
                      <textarea
                        id={`cancel-reason-${session.id}`}
                        value={reason}
                        disabled={isCancelling}
                        maxLength={
                          BOOKING_MAX_CANCELLATION_REASON_LENGTH
                        }
                        rows={3}
                        onChange={(event) =>
                          setReason(
                            event.target.value,
                          )
                        }
                        className="mt-2 w-full resize-y rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-200/50 disabled:opacity-60"
                        placeholder={t(
                          "reasonPlaceholder",
                        )}
                      />

                      {cancelError ? (
                        <p
                          role="alert"
                          className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
                        >
                          {cancelError}
                        </p>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={
                            isCancelling
                          }
                          onClick={() =>
                            void handleCancel(
                              session.id,
                            )
                          }
                          className="rounded-full bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50"
                        >
                          {isCancelling
                            ? t("cancelling")
                            : t("confirmCancel")}
                        </button>
                        <button
                          type="button"
                          disabled={
                            isCancelling
                          }
                          onClick={
                            closeCancellation
                          }
                          className="rounded-full px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-800 disabled:opacity-50"
                        >
                          {t("keepSession")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {hasMore ? (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              disabled={isLoadingMore}
              onClick={() =>
                void handleLoadMore()
              }
              className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 transition hover:border-zinc-950 hover:bg-zinc-950 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:opacity-50"
            >
              {isLoadingMore
                ? t("loadingMore")
                : t("loadMore")}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );

}
