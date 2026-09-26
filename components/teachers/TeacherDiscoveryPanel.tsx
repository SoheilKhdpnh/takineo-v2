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
  buildTeacherDiscoveryUrl,
  getTeacherDiscoveryRange,
  parseTeacherDiscoveryResponse,
  type PublicTeacherDiscoveryItem,
} from "@/components/teachers/teacher-discovery-api";
import { TeacherCard } from "@/components/teachers/TeacherCard";
import { TeacherDiscoveryHero } from "@/components/teachers/TeacherDiscoveryHero";
import { Button } from "@/components/ui/Button";
import { BOOKING_OPERATIONAL_TIMEZONE } from "@/lib/domain/booking-policy";
import type { ProfileLanguageCode } from "@/lib/domain/profile";
import { cn } from "@/lib/ui/cn";

type LoadState =
  | "loading"
  | "ready"
  | "error";

type AvailabilityFilter =
  | "all"
  | "open";

export function TeacherDiscoveryPanel({
  showHeader = true,
}: {
  showHeader?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("TeacherDiscovery");
  const common = useTranslations("ProfileCommon");

  const [range] = useState(() =>
    getTeacherDiscoveryRange(new Date()),
  );
  const [teachers, setTeachers] = useState<
    PublicTeacherDiscoveryItem[]
  >([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [availabilityFilter, setAvailabilityFilter] =
    useState<AvailabilityFilter>("all");
  const [nativeFilter, setNativeFilter] =
    useState<ProfileLanguageCode | "all">("all");

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en", {
        timeZone: BOOKING_OPERATIONAL_TIMEZONE,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale],
  );

  const fetchPage = useCallback(
    async (cursor?: string | null, signal?: AbortSignal) => {
      const response = await fetch(
        buildTeacherDiscoveryUrl(range, cursor),
        {
          method: "GET",
          signal,
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Teacher discovery request failed.");
      }

      const payload: unknown = await response.json();
      const parsed = parseTeacherDiscoveryResponse(payload);

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
    async (signal?: AbortSignal) => {
      try {
        const result = await fetchPage(null, signal);
        setTeachers(result.teachers);
        setNextCursor(result.nextCursor);
        setLoadState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setLoadState("error");
      }
    },
    [fetchPage],
  );

  useEffect(() => {
    const controller = new AbortController();

    void Promise.resolve().then(() =>
      loadInitial(controller.signal),
    );

    return () => {
      controller.abort();
    };
  }, [loadInitial]);

  async function handleLoadMore() {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setNotice(null);

    try {
      const result = await fetchPage(nextCursor);
      const existingIds = new Set(
        teachers.map((teacher) => teacher.teacherProfileId),
      );

      if (
        result.teachers.some((teacher) =>
          existingIds.has(teacher.teacherProfileId),
        ) ||
        result.nextCursor === nextCursor
      ) {
        throw new Error(
          "Teacher discovery pagination violated the public contract.",
        );
      }

      setTeachers((current) => [...current, ...result.teachers]);
      setNextCursor(result.nextCursor);
    } catch {
      setNotice(t("loadMoreError"));
    } finally {
      setIsLoadingMore(false);
    }
  }

  const nativeOptions = useMemo(() => {
    const codes = new Set(
      teachers.map((teacher) => teacher.nativeLanguage),
    );

    return Array.from(codes);
  }, [teachers]);

  const visibleTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
      if (
        availabilityFilter === "open" &&
        teacher.nextAvailableAt === null
      ) {
        return false;
      }

      if (
        nativeFilter !== "all" &&
        teacher.nativeLanguage !== nativeFilter
      ) {
        return false;
      }

      return true;
    });
  }, [teachers, availabilityFilter, nativeFilter]);

  function nextAvailableLabel(
    teacher: PublicTeacherDiscoveryItem,
  ): string | null {
    return teacher.nextAvailableAt
      ? dateTimeFormatter.format(new Date(teacher.nextAvailableAt))
      : null;
  }

  const listBody = (() => {
    if (loadState === "loading") {
      return (
        <div
          role="status"
          aria-live="polite"
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          <span className="sr-only">{t("loading")}</span>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              aria-hidden="true"
              className="min-h-80 animate-pulse rounded-[1.35rem] border border-[#edddd4] bg-white p-5 motion-reduce:animate-none"
            >
              <div className="flex gap-3">
                <div className="size-14 rounded-full bg-[#fff4ed]" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 w-2/5 rounded-full bg-[#fff4ed]" />
                  <div className="h-3 w-3/5 rounded-full bg-[#fff4ed]" />
                </div>
              </div>
              <div className="mt-5 h-16 rounded-xl bg-[#fff4ed]" />
              <div className="mt-4 aspect-[16/10] rounded-2xl bg-[#fff4ed]" />
              <div className="mt-4 h-11 rounded-xl bg-[#fff4ed]" />
            </div>
          ))}
        </div>
      );
    }

    if (loadState === "error") {
      return (
        <div
          role="alert"
          className="rounded-[1.35rem] border border-red-200 bg-red-50 px-5 py-8 sm:px-8"
        >
          <h3 className="text-lg font-semibold text-red-900">
            {t("loadErrorTitle")}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-red-800/80">
            {t("loadErrorDescription")}
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setLoadState("loading");
              setNotice(null);
              void loadInitial();
            }}
          >
            {t("tryAgain")}
          </Button>
        </div>
      );
    }

    if (teachers.length === 0) {
      return (
        <div className="rounded-[1.35rem] border border-dashed border-[#edddd4] bg-white px-6 py-12 text-center sm:px-10">
          <h3 className="text-xl font-semibold text-[#1c1410]">
            {t("emptyTitle")}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-zinc-600">
            {t("emptyDescription")}
          </p>
        </div>
      );
    }

    if (visibleTeachers.length === 0) {
      return (
        <div className="rounded-[1.35rem] border border-dashed border-[#edddd4] bg-white px-6 py-12 text-center">
          <h3 className="text-xl font-semibold text-[#1c1410]">
            {t("filterEmptyTitle")}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-zinc-600">
            {t("filterEmptyDescription")}
          </p>
        </div>
      );
    }

    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visibleTeachers.map((teacher) => (
          <TeacherCard
            key={teacher.teacherProfileId}
            teacher={teacher}
            nextAvailableLabel={nextAvailableLabel(teacher)}
          />
        ))}
      </div>
    );
  })();

  return (
    <section aria-labelledby="teacher-discovery-title" className="bg-[#f7f1ea]">
      {showHeader ? (
        <TeacherDiscoveryHero
          nativeFilter={nativeFilter}
          nativeOptions={nativeOptions}
          onSearch={({ nativeLanguage }) => {
            setNativeFilter(nativeLanguage);
            setAvailabilityFilter("all");
          }}
        />
      ) : (
        <h2 id="teacher-discovery-title" className="sr-only">
          {t("title")}
        </h2>
      )}

      {showHeader ? (
        <h2 id="teacher-discovery-title" className="sr-only">
          {t("title")}
        </h2>
      ) : null}

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {teachers.length > 0 || loadState === "ready" ? (
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <p className="sr-only">{t("filtersLabel")}</p>
              <FilterChip
                pressed={availabilityFilter === "all" && nativeFilter === "all"}
                onClick={() => {
                  setAvailabilityFilter("all");
                  setNativeFilter("all");
                }}
              >
                {t("filterAllLanguages")}
              </FilterChip>
              <FilterChip
                pressed={availabilityFilter === "open"}
                onClick={() =>
                  setAvailabilityFilter((current) =>
                    current === "open" ? "all" : "open",
                  )
                }
              >
                {t("filterAvailable")}
              </FilterChip>
              {nativeOptions.map((code) => (
                <FilterChip
                  key={code}
                  pressed={nativeFilter === code}
                  onClick={() =>
                    setNativeFilter((current) =>
                      current === code ? "all" : code,
                    )
                  }
                >
                  {t("filterNative", {
                    language: common(`languages.${code}`),
                  })}
                </FilterChip>
              ))}
            </div>

            <p className="inline-flex items-center gap-2 self-start rounded-full border border-[#edddd4] bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 lg:self-auto">
              <SortIcon />
              {t("sortByDefault")}
            </p>
          </div>
        ) : null}

        {listBody}

        <div aria-live="polite" className="mt-5">
          {notice ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
            >
              {notice}
            </p>
          ) : null}
        </div>

        {nextCursor ? (
          <div className="mt-8 flex justify-center">
            <Button
              variant="secondary"
              disabled={isLoadingMore}
              onClick={() => void handleLoadMore()}
            >
              {isLoadingMore ? t("loadingMore") : t("loadMore")}
            </Button>
          </div>
        ) : null}

        {showHeader ? (
          <p className="mt-8 text-center text-xs leading-5 text-zinc-500">
            {t("advisory")}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm font-semibold transition",
        pressed
          ? "border-[#c2410c] bg-[#c2410c] text-white"
          : "border-[#edddd4] bg-white text-[#1c1410] hover:bg-[#fff4ed]",
      )}
    >
      {children}
      <ChevronTiny className="ms-1.5" />
    </button>
  );
}

function ChevronTiny({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={cn("size-3.5 opacity-70", className)}
      aria-hidden="true"
    >
      <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-4 text-zinc-400"
      aria-hidden="true"
    >
      <path d="M4 7h12M4 12h8M4 17h5" strokeLinecap="round" />
      <path d="m16 14 3 3 3-3M19 7v10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
