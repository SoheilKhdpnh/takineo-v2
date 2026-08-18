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
  AuthoritativeSlotPicker,
} from "@/components/booking/AuthoritativeSlotPicker";
import {
  createStudentBooking,
  generateBookingIdempotencyKey,
  getBookableSlots,
  getBookingBrowseRange,
  getPublicTeacherDetail,
  isBookingApiError,
  type BookableSlot,
  type BookableSlotsResponse,
  type BookingAttempt,
  type CreatedBookingSession,
  type PublicTeacherDetail,
} from "@/components/booking/student-booking-api";
import {
  Link,
} from "@/i18n/navigation";
import {
  BOOKING_OPERATIONAL_TIMEZONE,
} from "@/lib/domain/booking-policy";

type LoadState =
  | "loading"
  | "ready"
  | "error"
  | "notFound";

type SlotsState =
  | "loading"
  | "ready"
  | "error";

type BookingNotice =
  | "networkRetry"
  | "slotUnavailable"
  | "bookingConflict"
  | "idempotencyConflict"
  | "limitExceeded"
  | "studentIneligible"
  | "selfBooking"
  | "authRequired"
  | "untrustedOrigin"
  | "invalidRequest"
  | "internalError"
  | null;

type TeacherBookingExperienceProps = {
  teacherProfileId: string;
};

function initialsFor(
  name: string,
): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.length === 0
    ? "T"
    : parts
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

export function TeacherBookingExperience({
  teacherProfileId,
}: TeacherBookingExperienceProps) {
  const locale = useLocale();
  const t = useTranslations(
    "StudentBooking",
  );
  const common = useTranslations(
    "ProfileCommon",
  );

  const [range] = useState(() =>
    getBookingBrowseRange(
      new Date(),
    ),
  );
  const [loadState, setLoadState] =
    useState<LoadState>(
      "loading",
    );
  const [slotsState, setSlotsState] =
    useState<SlotsState>(
      "loading",
    );
  const [teacher, setTeacher] =
    useState<PublicTeacherDetail | null>(
      null,
    );
  const [slotResponse, setSlotResponse] =
    useState<BookableSlotsResponse | null>(
      null,
    );
  const [selectedSlot, setSelectedSlot] =
    useState<BookableSlot | null>(
      null,
    );
  const [attempt, setAttempt] =
    useState<BookingAttempt | null>(
      null,
    );
  const [isBooking, setIsBooking] =
    useState(false);
  const [bookingNotice, setBookingNotice] =
    useState<BookingNotice>(null);
  const [confirmedSession, setConfirmedSession] =
    useState<CreatedBookingSession | null>(
      null,
    );

  const dateTimeFormatter = useMemo(
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
          hour: "2-digit",
          minute: "2-digit",
        },
      ),
    [locale],
  );

  const loadTeacher = useCallback(
    async (
      signal?: AbortSignal,
    ) => {
      try {
        const detail =
          await getPublicTeacherDetail(
            teacherProfileId,
            signal,
          );

        setTeacher(detail);
        setLoadState((current) =>
          current === "notFound"
            ? current
            : "ready",
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        if (
          isBookingApiError(error) &&
          error.code ===
            "TEACHER_NOT_FOUND"
        ) {
          setLoadState("notFound");
          return;
        }

        setLoadState((current) =>
          current === "notFound"
            ? current
            : "error",
        );
      }
    },
    [teacherProfileId],
  );

  const loadSlots = useCallback(
    async (
      signal?: AbortSignal,
    ) => {
      setSlotsState("loading");

      try {
        const result =
          await getBookableSlots(
            teacherProfileId,
            range,
            signal,
          );

        setSlotResponse(result);
        setSlotsState("ready");
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        if (
          isBookingApiError(error) &&
          error.code ===
            "TEACHER_NOT_FOUND"
        ) {
          setLoadState("notFound");
          return;
        }

        setSlotsState("error");
      }
    },
    [range, teacherProfileId],
  );

  useEffect(() => {
    const controller =
      new AbortController();

    void Promise.resolve().then(
      async () => {
        if (controller.signal.aborted) {
          return;
        }

        await Promise.all([
          loadTeacher(controller.signal),
          loadSlots(controller.signal),
        ]);
      },
    );

    return () => {
      controller.abort();
    };
  }, [loadSlots, loadTeacher]);

  function selectSlot(
    slot: BookableSlot,
  ) {
    if (isBooking) {
      return;
    }

    if (
      selectedSlot?.startAt === slot.startAt &&
      attempt
    ) {
      return;
    }

    const nextAttempt: BookingAttempt = {
      teacherProfileId,
      startAt: slot.startAt,
      idempotencyKey:
        generateBookingIdempotencyKey(),
    };

    setSelectedSlot(slot);
    setAttempt(nextAttempt);
    setBookingNotice(null);
  }

  async function refetchAfterConflict() {
    setSelectedSlot(null);
    setAttempt(null);
    await loadSlots();
  }

  async function submitBooking(
    bookingAttempt:
      BookingAttempt | null = attempt,
  ) {
    if (
      !bookingAttempt ||
      isBooking
    ) {
      return;
    }

    setIsBooking(true);
    setBookingNotice(null);

    try {
      const session =
        await createStudentBooking(
          bookingAttempt,
        );

      setConfirmedSession(session);
      setSelectedSlot(null);
      setAttempt(null);
    } catch (error) {
      if (!isBookingApiError(error)) {
        setBookingNotice(
          "networkRetry",
        );
        return;
      }

      switch (error.code) {
        case "SLOT_UNAVAILABLE":
          setBookingNotice(
            "slotUnavailable",
          );
          await refetchAfterConflict();
          return;

        case "BOOKING_CONFLICT":
          setBookingNotice(
            "bookingConflict",
          );
          await refetchAfterConflict();
          return;

        case "IDEMPOTENCY_CONFLICT":
          setBookingNotice(
            "idempotencyConflict",
          );
          await refetchAfterConflict();
          return;

        case "TEACHER_NOT_FOUND":
          setLoadState("notFound");
          return;

        case "BOOKING_LIMIT_EXCEEDED":
          setBookingNotice(
            "limitExceeded",
          );
          return;

        case "BOOKING_STUDENT_NOT_ELIGIBLE":
          setBookingNotice(
            "studentIneligible",
          );
          return;

        case "SELF_BOOKING_FORBIDDEN":
          setBookingNotice(
            "selfBooking",
          );
          return;

        case "UNAUTHORIZED":
          setBookingNotice(
            "authRequired",
          );
          return;

        case "UNTRUSTED_ORIGIN":
          setBookingNotice(
            "untrustedOrigin",
          );
          return;

        case "INVALID_JSON":
        case "INVALID_REQUEST":
          setBookingNotice(
            "invalidRequest",
          );
          return;

        case "INTERNAL_SERVER_ERROR":
        case "INVALID_DATE_RANGE":
        case "RANGE_TOO_LARGE":
          setBookingNotice(
            "internalError",
          );
          return;
      }
    } finally {
      setIsBooking(false);
    }
  }

  if (loadState === "loading") {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-12">
        <section
          role="status"
          aria-live="polite"
          className="mx-auto max-w-5xl animate-pulse rounded-[2rem] border border-zinc-200 bg-white p-8 motion-reduce:animate-none"
        >
          <span className="sr-only">
            {t("loadingProfile")}
          </span>
          <div className="h-5 w-32 rounded-full bg-zinc-200" />
          <div className="mt-5 h-10 w-2/3 rounded-2xl bg-zinc-200" />
          <div className="mt-8 h-72 rounded-[1.75rem] bg-zinc-100" />
        </section>
      </main>
    );
  }

  if (loadState === "notFound") {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-12">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-zinc-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-zinc-950 text-xl font-semibold text-white">
            ?
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-950">
            {t("teacherUnavailableTitle")}
          </h1>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-zinc-600">
            {t("teacherUnavailableDescription")}
          </p>
          <Link
            href="/student/dashboard"
            className="mt-7 inline-flex rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
          >
            {t("backToDiscovery")}
          </Link>
        </section>
      </main>
    );
  }

  if (
    loadState === "error" ||
    !teacher
  ) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-12">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-sm sm:p-12">
          <h1 className="text-2xl font-semibold text-zinc-950">
            {t("profileLoadErrorTitle")}
          </h1>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-zinc-600">
            {t("profileLoadErrorDescription")}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoadState("loading");
              setSlotsState("loading");
              void Promise.all([
                loadTeacher(),
                loadSlots(),
              ]);
            }}
            className="mt-6 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white"
          >
            {t("tryAgain")}
          </button>
        </section>
      </main>
    );
  }

  const bookingBlocked =
    bookingNotice ===
      "networkRetry" ||
    bookingNotice ===
      "internalError" ||
    bookingNotice ===
      "limitExceeded" ||
    bookingNotice ===
      "studentIneligible" ||
    bookingNotice ===
      "selfBooking" ||
    bookingNotice ===
      "authRequired" ||
    bookingNotice ===
      "untrustedOrigin" ||
    bookingNotice ===
      "invalidRequest";

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 sm:py-12">
      <section className="mx-auto max-w-5xl">
        <div className="mb-5">
          <Link
            href="/student/dashboard"
            className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
          >
            {t("backToDiscovery")}
          </Link>
        </div>

        <article className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_28px_80px_-42px_rgba(24,24,27,0.35)]">
          <header className="relative overflow-hidden bg-zinc-950 px-6 py-8 text-white sm:px-9 sm:py-10">
            <div
              aria-hidden="true"
              className="absolute -end-20 -top-24 size-72 rounded-full border border-white/10"
            />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
              <div
                aria-hidden="true"
                style={avatarStyle(
                  teacher.image,
                )}
                className="flex size-24 shrink-0 items-center justify-center rounded-[1.75rem] bg-white/10 bg-cover bg-center text-2xl font-bold text-white ring-1 ring-white/15"
              >
                <span className={
                  teacher.image
                    ? "rounded-lg bg-black/45 px-2 py-1 text-sm backdrop-blur-sm"
                    : undefined
                }>
                  {initialsFor(
                    teacher.name,
                  )}
                </span>
              </div>

              <div className="max-w-2xl">
                <p className={[
                  "text-xs font-semibold text-zinc-400",
                  locale === "fa"
                    ? "tracking-normal"
                    : "uppercase tracking-[0.16em]",
                ].join(" ")}>
                  {t("profileEyebrow")}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {teacher.name}
                </h1>
                <p className="mt-3 text-base leading-7 text-zinc-300">
                  {teacher.headline ??
                    t("headlineFallback")}
                </p>
              </div>
            </div>
          </header>

          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.4fr]">
            <aside className="space-y-5">
              <section className="rounded-[1.75rem] border border-zinc-200 bg-zinc-50 p-5">
                <h2 className="text-lg font-semibold text-zinc-950">
                  {t("aboutTeacher")}
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-600">
                  {teacher.bio ??
                    t("bioFallback")}
                </p>

                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-3">
                    <dt className="text-zinc-500">
                      {t("nativeLanguage")}
                    </dt>
                    <dd className="font-semibold text-zinc-950">
                      {common(
                        `languages.${teacher.nativeLanguage}`,
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-3">
                    <dt className="text-zinc-500">
                      {t("teachingLanguage")}
                    </dt>
                    <dd className="font-semibold text-zinc-950">
                      {common(
                        `languages.${teacher.teachingLanguage}`,
                      )}
                    </dd>
                  </div>
                  {teacher.experienceYears !== null ? (
                    <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-3">
                      <dt className="text-zinc-500">
                        {t("experience")}
                      </dt>
                      <dd className="font-semibold text-zinc-950">
                        {t("experienceYears", {
                          years:
                            teacher.experienceYears,
                        })}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
                <p className="font-semibold">
                  {t("authorityTitle")}
                </p>
                <p className="mt-1 text-amber-900/80">
                  {t("authorityDescription")}
                </p>
              </div>
            </aside>

            <section
              aria-labelledby="booking-slots-heading"
              className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 sm:p-6"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    {t("slotsEyebrow")}
                  </p>
                  <h2
                    id="booking-slots-heading"
                    className="mt-1 text-2xl font-semibold text-zinc-950"
                  >
                    {t("slotsTitle")}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-7 text-zinc-600">
                    {t("slotsDescription")}
                  </p>
                </div>
                <span className="text-xs font-semibold text-zinc-500">
                  {t("tehranTime")}
                </span>
              </div>

              <div className="mt-6">
                {slotsState === "loading" ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                  >
                    <span className="sr-only">
                      {t("loadingSlots")}
                    </span>
                    {Array.from({
                      length: 8,
                    }).map((_, index) => (
                      <div
                        key={index}
                        aria-hidden="true"
                        className="h-12 animate-pulse rounded-2xl bg-zinc-100 motion-reduce:animate-none"
                      />
                    ))}
                  </div>
                ) : null}

                {slotsState === "error" ? (
                  <div
                    role="alert"
                    className="rounded-2xl border border-red-100 bg-red-50 p-5 text-red-950"
                  >
                    <p className="font-semibold">
                      {t("slotsLoadErrorTitle")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-red-900/80">
                      {t("slotsLoadErrorDescription")}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void loadSlots()
                      }
                      className="mt-4 rounded-full bg-red-950 px-4 py-2 text-sm font-semibold text-white"
                    >
                      {t("tryAgain")}
                    </button>
                  </div>
                ) : null}

                {slotsState === "ready" &&
                slotResponse ? (
                  <AuthoritativeSlotPicker
                    slots={slotResponse.slots}
                    selectedStartAt={
                      selectedSlot?.startAt ??
                      null
                    }
                    onSelect={selectSlot}
                    disabled={
                      isBooking ||
                      bookingBlocked ||
                      confirmedSession !== null
                    }
                  />
                ) : null}
              </div>

              {selectedSlot &&
              confirmedSession === null ? (
                <div className="mt-6 rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
                  <p className="text-sm font-semibold text-zinc-950">
                    {t("selectedSlot")}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {dateTimeFormatter.format(
                      new Date(
                        selectedSlot.startAt,
                      ),
                    )}
                  </p>
                  <button
                    type="button"
                    disabled={
                      isBooking ||
                      bookingBlocked
                    }
                    onClick={() =>
                      void submitBooking()
                    }
                    className="mt-4 w-full rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isBooking
                      ? t("booking")
                      : t("confirmBooking")}
                  </button>
                </div>
              ) : null}

              {bookingNotice ? (
                <BookingNoticePanel
                  notice={bookingNotice}
                  onRetrySameAttempt={
                    attempt
                      ? () =>
                          void submitBooking(
                            attempt,
                          )
                      : undefined
                  }
                />
              ) : null}

              {confirmedSession ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-6 rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"
                >
                  <p className="text-lg font-semibold">
                    {t("confirmedTitle")}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-emerald-900/80">
                    {t("confirmedDescription", {
                      time:
                        dateTimeFormatter.format(
                          new Date(
                            confirmedSession.startAt,
                          ),
                        ),
                    })}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/student/dashboard"
                      className="rounded-full bg-emerald-950 px-4 py-2 text-sm font-semibold text-white"
                    >
                      {t("viewUpcoming")}
                    </Link>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </article>
      </section>
    </main>
  );
}

function BookingNoticePanel({
  notice,
  onRetrySameAttempt,
}: {
  notice: Exclude<
    BookingNotice,
    null
  >;
  onRetrySameAttempt?: () => void;
}) {
  const t = useTranslations(
    "StudentBooking",
  );

  const retryable =
    notice === "networkRetry" ||
    notice === "internalError";

  return (
    <div
      role="alert"
      className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"
    >
      <p className="font-semibold">
        {t(`notices.${notice}.title`)}
      </p>
      <p className="mt-1 text-sm leading-6 text-amber-900/80">
        {t(
          `notices.${notice}.description`,
        )}
      </p>

      {notice === "authRequired" ? (
        <Link
          href="/sign-in"
          className="mt-3 inline-flex rounded-full bg-amber-950 px-4 py-2 text-sm font-semibold text-white"
        >
          {t("signIn")}
        </Link>
      ) : null}

      {retryable &&
      onRetrySameAttempt ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRetrySameAttempt}
            className="rounded-full bg-amber-950 px-4 py-2 text-sm font-semibold text-white"
          >
            {t("retrySameAttempt")}
          </button>
          <Link
            href="/student/dashboard"
            className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950"
          >
            {t("checkUpcoming")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
