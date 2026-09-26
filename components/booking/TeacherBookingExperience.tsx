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
import { PublicTeacherProfileLayout } from "@/components/teachers/PublicTeacherProfileLayout";
import { Link } from "@/i18n/navigation";
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

export function TeacherBookingExperience({
  teacherProfileId,
}: TeacherBookingExperienceProps) {
  const locale = useLocale();
  const t = useTranslations(
    "StudentBooking",
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
      <main className="bg-transparent px-4 py-12">
        <section
          role="status"
          aria-live="polite"
          className="mx-auto max-w-5xl animate-pulse rounded-lg border border-line bg-surface p-8 motion-reduce:animate-none"
        >
          <span className="sr-only">
            {t("loadingProfile")}
          </span>
          <div className="h-5 w-32 rounded-full bg-mint" />
          <div className="mt-5 h-10 w-2/3 rounded-md bg-mint" />
          <div className="mt-8 h-72 rounded-lg bg-canvas" />
        </section>
      </main>
    );
  }

  if (loadState === "notFound") {
    return (
      <main className="bg-transparent px-4 py-12">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-line bg-surface p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-ink text-xl font-semibold text-white">
            ?
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink">
            {t("teacherUnavailableTitle")}
          </h1>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-ink-muted">
            {t("teacherUnavailableDescription")}
          </p>
          <Link
            href="/teachers"
            className="mt-7 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
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
      <main className="bg-transparent px-4 py-12">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-red-100 bg-surface p-8 text-center shadow-sm sm:p-12">
          <h1 className="text-2xl font-semibold text-ink">
            {t("profileLoadErrorTitle")}
          </h1>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-ink-muted">
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
            className="mt-6 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white"
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
    <PublicTeacherProfileLayout
      teacher={teacher}
      slotResponse={slotResponse}
      slotsState={slotsState}
      selectedSlot={selectedSlot}
      selectedSlotLabel={
        selectedSlot
          ? dateTimeFormatter.format(new Date(selectedSlot.startAt))
          : null
      }
      isBooking={isBooking}
      bookingBlocked={bookingBlocked}
      confirmedSession={confirmedSession}
      onSelectSlot={selectSlot}
      onConfirmBooking={() => void submitBooking()}
      onRetrySlots={() => void loadSlots()}
      dateTimeFormatter={dateTimeFormatter}
      bookingNotice={
        <>
          {bookingNotice ? (
            <BookingNoticePanel
              notice={bookingNotice}
              onRetrySameAttempt={
                attempt
                  ? () => void submitBooking(attempt)
                  : undefined
              }
            />
          ) : null}
          {confirmedSession ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
            >
              <p className="font-semibold">{t("confirmedTitle")}</p>
              <p className="mt-1 text-sm leading-6 text-emerald-900/80">
                {t("confirmedDescription", {
                  time: dateTimeFormatter.format(
                    new Date(confirmedSession.startAt),
                  ),
                })}
              </p>
              <Link
                href="/student/dashboard"
                className="mt-3 inline-flex rounded-full bg-emerald-950 px-4 py-2 text-sm font-semibold text-white"
              >
                {t("viewUpcoming")}
              </Link>
            </div>
          ) : null}
        </>
      }
    >
      {slotsState === "loading" ? (
        <div
          role="status"
          aria-live="polite"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          <span className="sr-only">{t("loadingSlots")}</span>
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              aria-hidden="true"
              className="h-12 animate-pulse rounded-md bg-[#fff4ed] motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : null}

      {slotsState === "error" ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-100 bg-red-50 p-5 text-red-950"
        >
          <p className="font-semibold">{t("slotsLoadErrorTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-red-900/80">
            {t("slotsLoadErrorDescription")}
          </p>
          <button
            type="button"
            onClick={() => void loadSlots()}
            className="mt-4 rounded-full bg-red-950 px-4 py-2 text-sm font-semibold text-white"
          >
            {t("tryAgain")}
          </button>
        </div>
      ) : null}

      {slotsState === "ready" && slotResponse ? (
        <AuthoritativeSlotPicker
          slots={slotResponse.slots}
          selectedStartAt={selectedSlot?.startAt ?? null}
          onSelect={selectSlot}
          disabled={
            isBooking || bookingBlocked || confirmedSession !== null
          }
        />
      ) : null}
    </PublicTeacherProfileLayout>
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
            className="rounded-full border border-amber-300 bg-surface px-4 py-2 text-sm font-semibold text-amber-950"
          >
            {t("checkUpcoming")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
