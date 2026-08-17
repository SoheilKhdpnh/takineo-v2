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
  type CSSProperties,
} from "react";

import {
  buildTeacherDiscoveryUrl,
  getTeacherDiscoveryRange,
  parseTeacherDiscoveryResponse,
  type PublicTeacherDiscoveryItem,
} from "@/components/teachers/teacher-discovery-api";
import {
  BOOKING_OPERATIONAL_TIMEZONE,
} from "@/lib/domain/booking-policy";

type LoadState =
  | "loading"
  | "ready"
  | "error";

function initialsFor(
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
      part.slice(0, 1),
    )
    .join("")
    .toUpperCase();
}

function avatarStyle(
  image: string | null,
): CSSProperties | undefined {
  if (!image) {
    return undefined;
  }

  return {
    backgroundImage:
      `url(${JSON.stringify(image)})`,
  };
}

export function TeacherDiscoveryPanel() {
  const locale = useLocale();
  const t = useTranslations(
    "TeacherDiscovery",
  );
  const common = useTranslations(
    "ProfileCommon",
  );

  const [range] = useState(() =>
    getTeacherDiscoveryRange(
      new Date(),
    ),
  );

  const [teachers, setTeachers] =
    useState<
      PublicTeacherDiscoveryItem[]
    >([]);
  const [nextCursor, setNextCursor] =
    useState<string | null>(null);
  const [loadState, setLoadState] =
    useState<LoadState>("loading");
  const [isLoadingMore, setIsLoadingMore] =
    useState(false);
  const [notice, setNotice] =
    useState<string | null>(null);

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(
        locale === "fa"
          ? "fa-IR"
          : "en",
        {
          timeZone:
            BOOKING_OPERATIONAL_TIMEZONE,
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      ),
    [locale],
  );

  const fetchPage = useCallback(
    async (
      cursor?: string | null,
      signal?: AbortSignal,
    ) => {
      const response = await fetch(
        buildTeacherDiscoveryUrl(
          range,
          cursor,
        ),
        {
          method: "GET",
          signal,
          headers: {
            Accept:
              "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          "Teacher discovery request failed.",
        );
      }

      const payload: unknown =
        await response.json();

      const parsed =
        parseTeacherDiscoveryResponse(
          payload,
        );

      if (!parsed) {
        throw new Error(
          "Teacher discovery response violated the public contract.",
        );
      }

      return parsed;
    },
    [range],
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

        setTeachers(
          result.teachers,
        );
        setNextCursor(
          result.nextCursor,
        );
        setLoadState("ready");
      }
      catch (error) {
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

      const existingIds =
        new Set(
          teachers.map((teacher) =>
            teacher.teacherProfileId,
          ),
        );

      if (
        result.teachers.some((teacher) =>
          existingIds.has(
            teacher.teacherProfileId,
          ),
        ) ||
        result.nextCursor === nextCursor
      ) {
        throw new Error(
          "Teacher discovery pagination violated the public contract.",
        );
      }

      setTeachers((current) => [
        ...current,
        ...result.teachers,
      ]);
      setNextCursor(
        result.nextCursor,
      );
    }
    catch {
      setNotice(
        t("loadMoreError"),
      );
    }
    finally {
      setIsLoadingMore(false);
    }
  }

  function retryInitialLoad() {
    setLoadState("loading");
    setNotice(null);
    void loadInitial();
  }

  function languageLabel(
    code: PublicTeacherDiscoveryItem["nativeLanguage"],
  ): string {
    return common(
      `languages.${code}`,
    );
  }

  if (loadState === "loading") {
    return (
      <section
        aria-labelledby="teacher-discovery-title"
        className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white shadow-[0_24px_70px_-40px_rgba(24,24,27,0.3)]"
      >
        <DiscoveryHeader />

        <div
          role="status"
          aria-live="polite"
          className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8"
        >
          <span className="sr-only">
            {t("loading")}
          </span>

          {Array.from({
            length: 4,
          }).map((_, index) => (
            <div
              key={index}
              aria-hidden="true"
              className="min-h-56 animate-pulse rounded-[1.75rem] border border-zinc-200 bg-zinc-50 p-5 motion-reduce:animate-none"
            >
              <div className="size-14 rounded-2xl bg-zinc-200" />
              <div className="mt-5 h-5 w-2/5 rounded-full bg-zinc-200" />
              <div className="mt-3 h-4 w-4/5 rounded-full bg-zinc-200" />
              <div className="mt-8 h-12 rounded-2xl bg-zinc-200" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (loadState === "error") {
    return (
      <section
        aria-labelledby="teacher-discovery-title"
        className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white shadow-[0_24px_70px_-40px_rgba(24,24,27,0.3)]"
      >
        <DiscoveryHeader />

        <div className="p-6 sm:p-8">
          <div
            role="alert"
            className="rounded-3xl border border-red-100 bg-red-50 p-5 text-red-950"
          >
            <h3 className="text-lg font-semibold">
              {t("loadErrorTitle")}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-red-900/80">
              {t("loadErrorDescription")}
            </p>

            <button
              type="button"
              onClick={retryInitialLoad}
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
      aria-labelledby="teacher-discovery-title"
      className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white shadow-[0_24px_70px_-40px_rgba(24,24,27,0.3)]"
    >
      <DiscoveryHeader />

      <div className="p-6 sm:p-8">
        {teachers.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center sm:px-10">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-zinc-950 text-lg text-white">
              ·
            </div>
            <h3 className="mt-5 text-xl font-semibold text-zinc-950">
              {t("emptyTitle")}
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-zinc-600">
              {t("emptyDescription")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {teachers.map((teacher) => (
              <article
                key={teacher.teacherProfileId}
                className="group relative overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_20px_50px_-34px_rgba(24,24,27,0.45)] sm:p-6"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-400/50 to-transparent opacity-0 transition group-hover:opacity-100" />

                <div className="flex items-start gap-4">
                  <div
                    aria-hidden="true"
                    style={avatarStyle(
                      teacher.image,
                    )}
                    className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 bg-cover bg-center text-sm font-bold text-white shadow-sm"
                  >
                    <span className={
                      teacher.image
                        ? "rounded-md bg-black/45 px-1.5 py-0.5 text-[0.65rem] backdrop-blur-sm"
                        : undefined
                    }>
                      {initialsFor(
                        teacher.name,
                      )}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-semibold text-zinc-950">
                      {teacher.name}
                    </h3>
                    <p className="mt-1 min-h-12 text-sm leading-6 text-zinc-600">
                      {teacher.headline ??
                        t("headlineFallback")}
                    </p>
                  </div>
                </div>

                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl bg-zinc-50 px-3.5 py-3">
                    <dt className="text-xs font-medium text-zinc-500">
                      {t("nativeLanguage")}
                    </dt>
                    <dd className="mt-1 font-semibold text-zinc-900">
                      {languageLabel(
                        teacher.nativeLanguage,
                      )}
                    </dd>
                  </div>

                  <div className="rounded-2xl bg-zinc-50 px-3.5 py-3">
                    <dt className="text-xs font-medium text-zinc-500">
                      {t("teachingLanguage")}
                    </dt>
                    <dd className="mt-1 font-semibold text-zinc-900">
                      {languageLabel(
                        teacher.teachingLanguage,
                      )}
                    </dd>
                  </div>
                </dl>

                {teacher.experienceYears !== null ? (
                  <p className="mt-4 text-sm font-medium text-zinc-600">
                    {t("experienceYears", {
                      years:
                        teacher.experienceYears,
                    })}
                  </p>
                ) : null}

                <div className="mt-5 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3.5">
                  <p className="text-xs font-semibold text-amber-950">
                    {t("nextAvailability")}
                  </p>
                  <p className="mt-1 font-semibold text-zinc-950">
                    {teacher.nextAvailableAt
                      ? dateTimeFormatter.format(
                          new Date(
                            teacher.nextAvailableAt,
                          ),
                        )
                      : t("noAvailability")}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-900/80">
                    {t("tehranTime")}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}

        <div
          aria-live="polite"
          className="mt-5"
        >
          {notice ? (
            <p
              role="alert"
              className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900"
            >
              {notice}
            </p>
          ) : null}
        </div>

        {nextCursor ? (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() =>
                void handleLoadMore()
              }
              disabled={isLoadingMore}
              className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 transition hover:border-zinc-950 hover:bg-zinc-950 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-wait disabled:opacity-50"
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

function DiscoveryHeader() {
  const locale = useLocale();
  const t = useTranslations(
    "TeacherDiscovery",
  );

  return (
    <div className="relative overflow-hidden bg-zinc-950 px-6 py-7 text-white sm:px-8 sm:py-8">
      <div
        aria-hidden="true"
        className="absolute -end-10 -top-16 size-48 rounded-full border border-white/10"
      />
      <div
        aria-hidden="true"
        className="absolute -end-3 -top-4 size-28 rounded-full border border-white/10"
      />

      <div className="relative max-w-2xl">
        <p
          className={[
            "text-xs font-semibold text-zinc-400",
            locale === "fa"
              ? "tracking-normal"
              : "uppercase tracking-[0.16em]",
          ].join(" ")}
        >
          {t("eyebrow")}
        </p>
        <h2
          id="teacher-discovery-title"
          className="mt-2 text-2xl font-semibold sm:text-3xl"
        >
          {t("title")}
        </h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300 sm:text-base">
          {t("description")}
        </p>

        <div className="mt-5 inline-flex max-w-xl items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-3 text-xs leading-5 text-zinc-300">
          <span
            aria-hidden="true"
            className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-300"
          />
          <span>
            {t("advisory")}
          </span>
        </div>
      </div>
    </div>
  );
}
