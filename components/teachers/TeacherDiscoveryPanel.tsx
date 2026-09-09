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
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BOOKING_OPERATIONAL_TIMEZONE } from "@/lib/domain/booking-policy";
import type { ProfileLanguageCode } from "@/lib/domain/profile";

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

  if (loadState === "loading") {
    return (
      <section aria-labelledby="teacher-discovery-title">
        {showHeader ? (
          <DiscoveryHeader />
        ) : (
          <h2 id="teacher-discovery-title" className="sr-only">
            {t("title")}
          </h2>
        )}
        <div
          role="status"
          aria-live="polite"
          className="grid gap-4 sm:grid-cols-2"
        >
          <span className="sr-only">{t("loading")}</span>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              aria-hidden="true"
              className="min-h-56 animate-pulse rounded-lg border border-line bg-surface p-5 motion-reduce:animate-none"
            >
              <div className="size-14 rounded-md bg-mint" />
              <div className="mt-5 h-5 w-2/5 rounded-full bg-mint" />
              <div className="mt-3 h-4 w-4/5 rounded-full bg-mint" />
              <div className="mt-8 h-12 rounded-md bg-mint" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (loadState === "error") {
    return (
      <section aria-labelledby="teacher-discovery-title">
        {showHeader ? (
          <DiscoveryHeader />
        ) : (
          <h2 id="teacher-discovery-title" className="sr-only">
            {t("title")}
          </h2>
        )}
        <Card role="alert" className="border-danger/20 bg-red-50">
          <h3 className="text-lg font-semibold text-danger">
            {t("loadErrorTitle")}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-danger/80">
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
        </Card>
      </section>
    );
  }

  return (
    <section aria-labelledby="teacher-discovery-title">
      {showHeader ? (
        <DiscoveryHeader />
      ) : (
        <h2 id="teacher-discovery-title" className="sr-only">
          {t("title")}
        </h2>
      )}

      {teachers.length > 0 ? (
        <div className="mb-5 flex flex-wrap gap-2">
          <p className="sr-only">{t("filtersLabel")}</p>
          <FilterChip
            pressed={availabilityFilter === "all"}
            onClick={() => setAvailabilityFilter("all")}
          >
            {t("filterAll")}
          </FilterChip>
          <FilterChip
            pressed={availabilityFilter === "open"}
            onClick={() => setAvailabilityFilter("open")}
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
      ) : null}

      {teachers.length === 0 ? (
        <Card className="border-dashed px-6 py-12 text-center sm:px-10">
          <h3 className="text-xl font-semibold text-ink">
            {t("emptyTitle")}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-ink-muted">
            {t("emptyDescription")}
          </p>
        </Card>
      ) : visibleTeachers.length === 0 ? (
        <Card className="border-dashed px-6 py-12 text-center">
          <h3 className="text-xl font-semibold text-ink">
            {t("filterEmptyTitle")}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-ink-muted">
            {t("filterEmptyDescription")}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleTeachers.map((teacher) => (
            <TeacherCard
              key={teacher.teacherProfileId}
              teacher={teacher}
              nextAvailableLabel={nextAvailableLabel(teacher)}
            />
          ))}
        </div>
      )}

      <div aria-live="polite" className="mt-5">
        {notice ? (
          <p
            role="alert"
            className="rounded-md border border-danger/20 bg-red-50 px-4 py-3 text-sm text-danger"
          >
            {notice}
          </p>
        ) : null}
      </div>

      {nextCursor ? (
        <div className="mt-5 flex justify-center">
          <Button
            variant="secondary"
            disabled={isLoadingMore}
            onClick={() => void handleLoadMore()}
          >
            {isLoadingMore ? t("loadingMore") : t("loadMore")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function DiscoveryHeader() {
  const t = useTranslations("TeacherDiscovery");

  return (
    <div className="mb-6 max-w-2xl">
      <p className="text-sm font-semibold text-primary">{t("eyebrow")}</p>
      <h2
        id="teacher-discovery-title"
        className="mt-2 text-2xl font-semibold text-ink sm:text-3xl"
      >
        {t("title")}
      </h2>
      <p className="mt-3 text-sm leading-7 text-ink-muted sm:text-base">
        {t("description")}
      </p>
      <p className="mt-4 text-xs leading-5 text-ink-muted">{t("advisory")}</p>
    </div>
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
      className={
        pressed
          ? "rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-white"
          : "rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:bg-mint"
      }
    >
      {children}
    </button>
  );
}
