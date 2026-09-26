"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";

import type {
  BookableSlot,
  BookableSlotsResponse,
  PublicTeacherDetail,
} from "@/components/booking/student-booking-api";
import { Link } from "@/i18n/navigation";
import { BOOKING_OPERATIONAL_TIMEZONE } from "@/lib/domain/booking-policy";
import { cn } from "@/lib/ui/cn";

type ProfileTab = "about" | "schedule" | "reviews" | "background";

export function PublicTeacherProfileLayout({
  teacher,
  slotResponse,
  slotsState,
  selectedSlot,
  selectedSlotLabel,
  isBooking,
  bookingBlocked,
  confirmedSession,
  bookingNotice,
  onSelectSlot,
  onConfirmBooking,
  onRetrySlots,
  children,
}: {
  teacher: PublicTeacherDetail;
  slotResponse: BookableSlotsResponse | null;
  slotsState: "loading" | "ready" | "error";
  selectedSlot: BookableSlot | null;
  selectedSlotLabel: string | null;
  isBooking: boolean;
  bookingBlocked: boolean;
  confirmedSession: { startAt: string } | null;
  bookingNotice: ReactNode;
  onSelectSlot: (slot: BookableSlot) => void;
  onConfirmBooking: () => void;
  onRetrySlots: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("StudentBooking");
  const common = useTranslations("ProfileCommon");
  const locale = useLocale();
  const [tab, setTab] = useState<ProfileTab>("about");

  const hasOpening =
    slotsState === "ready" &&
    (slotResponse?.slots.length ?? 0) > 0;

  const weekdaySlots = useMemo(() => {
    if (!slotResponse) {
      return [] as {
        key: string;
        label: string;
        times: { label: string; slot: BookableSlot }[];
      }[];
    }

    const dayFormatter = new Intl.DateTimeFormat(
      locale === "fa" ? "fa-IR" : "en",
      {
        timeZone: BOOKING_OPERATIONAL_TIMEZONE,
        weekday: "short",
      },
    );
    const timeFormatter = new Intl.DateTimeFormat(
      locale === "fa" ? "fa-IR" : "en",
      {
        timeZone: BOOKING_OPERATIONAL_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
      },
    );

    const byDay = new Map<
      string,
      { label: string; times: { label: string; slot: BookableSlot }[] }
    >();

    for (const slot of slotResponse.slots.slice(0, 40)) {
      const start = new Date(slot.startAt);
      const key = slot.date;
      const existing = byDay.get(key) ?? {
        label: dayFormatter.format(start),
        times: [],
      };

      if (existing.times.length < 4) {
        existing.times.push({
          label: timeFormatter.format(start),
          slot,
        });
      }

      byDay.set(key, existing);
    }

    return Array.from(byDay.entries())
      .slice(0, 7)
      .map(([key, value]) => ({ key, ...value }));
  }, [locale, slotResponse]);

  const tags = [
    t("tagProfessional"),
    t("tagOnlineSpeaking"),
    common(`languages.${teacher.teachingLanguage}`),
    teacher.experienceYears !== null
      ? t("tagExperienced", { years: teacher.experienceYears })
      : null,
  ].filter((value): value is string => Boolean(value));

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: "about", label: t("tabAbout") },
    { id: "schedule", label: t("tabSchedule") },
    { id: "reviews", label: t("tabReviews") },
    { id: "background", label: t("tabBackground") },
  ];

  function goToSchedule() {
    setTab("schedule");
    requestAnimationFrame(() => {
      document
        .getElementById("booking-slots-heading")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <main className="bg-[#f7f1ea] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/teachers"
          className="inline-flex items-center rounded-full border border-[#edddd4] bg-white px-4 py-2 text-sm font-semibold text-[#1c1410] transition hover:border-[#c2410c] hover:text-[#c2410c]"
        >
          {t("backToDiscovery")}
        </Link>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.9fr)] lg:items-start">
          <div className="space-y-5">
            <section className="rounded-[1.5rem] border border-[#edddd4] bg-white p-5 shadow-[0_18px_40px_-34px_rgba(28,20,16,0.4)] sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="relative size-28 shrink-0 overflow-hidden rounded-2xl bg-[#fff4ed] sm:size-32">
                  {teacher.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={teacher.image}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-3xl font-semibold text-[#c2410c]">
                      {teacher.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  {hasOpening ? (
                    <span className="absolute bottom-2 start-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-700">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {t("statusHasOpening")}
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-[#1c1410] sm:text-3xl">
                      {teacher.name}
                    </h1>
                    <VerifiedBadge label={t("verifiedLabel")} />
                  </div>
                  <p className="mt-1 text-sm leading-6 text-zinc-600 sm:text-base">
                    {teacher.headline?.trim() || t("headlineFallback")}
                  </p>

                  <ul className="mt-4 space-y-2 text-sm text-zinc-700">
                    {teacher.experienceYears !== null ? (
                      <li className="flex items-center gap-2">
                        <BriefcaseIcon />
                        <span>
                          {t("experienceYears", {
                            years: teacher.experienceYears,
                          })}
                        </span>
                      </li>
                    ) : null}
                    <li className="flex flex-wrap items-center gap-2">
                      <LanguageIcon />
                      <span>
                        {common(`languages.${teacher.nativeLanguage}`)}{" "}
                        <span className="rounded-md bg-[#fff4ed] px-1.5 py-0.5 text-xs font-semibold text-[#9a3412]">
                          {t("nativeBadge")}
                        </span>
                      </span>
                      <span className="text-zinc-300">·</span>
                      <span>
                        {common(`languages.${teacher.teachingLanguage}`)}{" "}
                        <span className="rounded-md bg-[#fff4ed] px-1.5 py-0.5 text-xs font-semibold text-[#9a3412]">
                          {t("teachingBadge")}
                        </span>
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <ClockIcon />
                      <span>{t("teachesOnline")}</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full border border-[#edddd4] bg-[#fffaf6] px-3 py-1.5 text-xs font-semibold text-[#9a3412]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-[1.5rem] border border-[#edddd4] bg-white shadow-[0_18px_40px_-34px_rgba(28,20,16,0.4)]">
              <div
                role="tablist"
                aria-label={t("profileTabsLabel")}
                className="flex gap-1 overflow-x-auto border-b border-[#edddd4] px-3"
              >
                {tabs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.id}
                    onClick={() => setTab(item.id)}
                    className={cn(
                      "relative shrink-0 px-4 py-3.5 text-sm font-semibold transition",
                      tab === item.id
                        ? "text-[#c2410c]"
                        : "text-zinc-500 hover:text-[#1c1410]",
                    )}
                  >
                    {item.label}
                    {tab === item.id ? (
                      <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#c2410c]" />
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="p-5 sm:p-6">
                {tab === "about" ? (
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-lg font-semibold text-[#1c1410]">
                        {t("aboutMeTitle")}
                      </h2>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-600">
                        {teacher.bio?.trim() || t("bioFallback")}
                      </p>
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold text-[#1c1410]">
                        {t("teachingStyleTitle")}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        {t("teachingStyleSubtitle")}
                      </p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-3">
                        {(
                          [
                            "studentCentered",
                            "practical",
                            "goalOriented",
                          ] as const
                        ).map((key) => (
                          <article
                            key={key}
                            className="rounded-2xl border border-[#edddd4] bg-[#fffaf6] p-4"
                          >
                            <span className="grid size-10 place-items-center rounded-xl bg-[#fff4ed] text-[#c2410c]">
                              {key === "studentCentered" ? (
                                <PeopleIcon />
                              ) : key === "practical" ? (
                                <ChatBubbleIcon />
                              ) : (
                                <TargetIcon />
                              )}
                            </span>
                            <h3 className="mt-3 text-sm font-semibold text-[#1c1410]">
                              {t(`teachingStyles.${key}.title`)}
                            </h3>
                            <p className="mt-1.5 text-sm leading-6 text-zinc-600">
                              {t(`teachingStyles.${key}.body`)}
                            </p>
                          </article>
                        ))}
                      </div>
                    </div>

                    <BackgroundStrip
                      teacher={teacher}
                      common={common}
                      t={t}
                    />
                  </div>
                ) : null}

                {tab === "schedule" ? (
                  <div id="booking-slots-heading">
                    <h2 className="text-lg font-semibold text-[#1c1410]">
                      {t("slotsTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      {t("slotsDescription")}
                    </p>
                    <div className="mt-4">{children}</div>
                  </div>
                ) : null}

                {tab === "reviews" ? (
                  <div className="rounded-2xl border border-dashed border-[#edddd4] bg-[#fffaf6] px-5 py-10 text-center">
                    <h2 className="text-lg font-semibold text-[#1c1410]">
                      {t("reviewsEmptyTitle")}
                    </h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
                      {t("reviewsEmptyDescription")}
                    </p>
                  </div>
                ) : null}

                {tab === "background" ? (
                  <BackgroundStrip
                    teacher={teacher}
                    common={common}
                    t={t}
                    detailed
                  />
                ) : null}
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <section className="rounded-[1.5rem] border border-[#edddd4] bg-white p-5 shadow-[0_18px_40px_-34px_rgba(28,20,16,0.4)]">
              <p className="text-3xl font-bold tracking-tight text-[#1c1410]">
                {t("sessionLengthValue")}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {t("sessionLengthHint")}
              </p>

              <button
                type="button"
                onClick={goToSchedule}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#c2410c] px-4 text-sm font-semibold text-white transition hover:bg-[#9a3412]"
              >
                {t("bookTrial")}
              </button>

              <div className="mt-4 rounded-2xl border border-[#edddd4] bg-[#fff4ed] px-4 py-3 text-sm leading-6 text-[#7c2d12]">
                <p className="font-semibold">{t("trialTitle")}</p>
                <p className="mt-1">{t("trialDescription")}</p>
              </div>

              {selectedSlot && !confirmedSession ? (
                <div className="mt-4 rounded-2xl border border-[#edddd4] bg-[#fffaf6] p-4">
                  <p className="text-xs font-semibold tracking-wide text-[#c2410c] uppercase">
                    {t("selectedSlot")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#1c1410]">
                    {selectedSlotLabel}
                  </p>
                  <button
                    type="button"
                    disabled={isBooking || bookingBlocked}
                    onClick={onConfirmBooking}
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#c2410c] px-4 text-sm font-semibold text-white transition hover:bg-[#9a3412] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isBooking ? t("booking") : t("confirmBooking")}
                  </button>
                </div>
              ) : null}

              {bookingNotice}
            </section>

            <section className="rounded-[1.5rem] border border-[#edddd4] bg-white p-5 shadow-[0_18px_40px_-34px_rgba(28,20,16,0.4)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-[#1c1410]">
                  {t("availabilityTitle")}
                </h2>
                <button
                  type="button"
                  onClick={goToSchedule}
                  className="text-sm font-semibold text-[#c2410c] hover:text-[#9a3412]"
                >
                  {t("viewFullSchedule")}
                </button>
              </div>

              {slotsState === "loading" ? (
                <p className="mt-4 text-sm text-zinc-500">{t("loadingSlots")}</p>
              ) : null}

              {slotsState === "error" ? (
                <div className="mt-4">
                  <p className="text-sm text-red-800">
                    {t("slotsLoadErrorTitle")}
                  </p>
                  <button
                    type="button"
                    onClick={onRetrySlots}
                    className="mt-2 text-sm font-semibold text-[#c2410c]"
                  >
                    {t("tryAgain")}
                  </button>
                </div>
              ) : null}

              {slotsState === "ready" && weekdaySlots.length === 0 ? (
                <p className="mt-4 text-sm leading-6 text-zinc-600">
                  {t("noSlotsDescription")}
                </p>
              ) : null}

              {weekdaySlots.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {weekdaySlots.map((day) => (
                    <li key={day.key}>
                      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        {day.label}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {day.times.map((time) => {
                          const selected =
                            selectedSlot?.startAt === time.slot.startAt;
                          return (
                            <button
                              key={time.slot.startAt}
                              type="button"
                              disabled={
                                isBooking ||
                                bookingBlocked ||
                                confirmedSession !== null
                              }
                              onClick={() => {
                                onSelectSlot(time.slot);
                                setTab("schedule");
                              }}
                              className={cn(
                                "rounded-lg border px-2.5 py-1 text-xs font-semibold transition",
                                selected
                                  ? "border-[#c2410c] bg-[#c2410c] text-white"
                                  : "border-[#edddd4] bg-[#fffaf6] text-[#1c1410] hover:border-[#fdba74]",
                              )}
                            >
                              {time.label}
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="rounded-[1.5rem] border border-[#edddd4] bg-white p-5 shadow-[0_18px_40px_-34px_rgba(28,20,16,0.4)]">
              <h2 className="text-base font-semibold text-[#1c1410]">
                {t("languagesISpeak")}
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-center justify-between gap-3">
                  <span>{common(`languages.${teacher.nativeLanguage}`)}</span>
                  <span className="rounded-md bg-[#fff4ed] px-2 py-0.5 text-xs font-semibold text-[#9a3412]">
                    {t("nativeBadge")}
                  </span>
                </li>
                {teacher.teachingLanguage !== teacher.nativeLanguage ? (
                  <li className="flex items-center justify-between gap-3">
                    <span>
                      {common(`languages.${teacher.teachingLanguage}`)}
                    </span>
                    <span className="rounded-md bg-[#fff4ed] px-2 py-0.5 text-xs font-semibold text-[#9a3412]">
                      {t("teachingBadge")}
                    </span>
                  </li>
                ) : null}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function BackgroundStrip({
  teacher,
  common,
  t,
  detailed = false,
}: {
  teacher: PublicTeacherDetail;
  common: ReturnType<typeof useTranslations>;
  t: ReturnType<typeof useTranslations>;
  detailed?: boolean;
}) {
  const items = [
    {
      title: t("backgroundTeaching"),
      body: common(`languages.${teacher.teachingLanguage}`),
      Icon: LanguageIcon,
    },
    {
      title: t("backgroundExperience"),
      body:
        teacher.experienceYears === null
          ? t("notProvided")
          : t("experienceYears", { years: teacher.experienceYears }),
      Icon: BriefcaseIcon,
    },
    {
      title: t("backgroundFormat"),
      body: t("teachesOnline"),
      Icon: GlobeIcon,
    },
  ];

  return (
    <div>
      {detailed ? (
        <h2 className="mb-4 text-lg font-semibold text-[#1c1410]">
          {t("backgroundTitle")}
        </h2>
      ) : (
        <h2 className="text-lg font-semibold text-[#1c1410]">
          {t("backgroundTitle")}
        </h2>
      )}
      <div
        className={cn(
          "mt-4 grid gap-4",
          detailed ? "sm:grid-cols-1" : "sm:grid-cols-3",
        )}
      >
        {items.map((item) => (
          <article
            key={item.title}
            className="flex items-start gap-3 rounded-2xl border border-[#edddd4] bg-[#fffaf6] p-4"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff4ed] text-[#c2410c]">
              <item.Icon />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#1c1410]">
                {item.title}
              </p>
              <p className="mt-1 text-sm text-zinc-600">{item.body}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function VerifiedBadge({ label }: { label: string }) {
  return (
    <span title={label} className="inline-flex text-[#c2410c]">
      <span className="sr-only">{label}</span>
      <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="currentColor" />
        <path
          d="M6.2 10.2 8.6 12.6 13.8 7.4"
          fill="none"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4 text-[#c2410c]" aria-hidden="true">
      <rect x="3.5" y="7" width="17" height="12.5" rx="2" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12h17" strokeLinecap="round" />
    </svg>
  );
}

function LanguageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4 text-[#c2410c]" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.8 2.5 14.2 0 17M12 3.5c-2.5 2.8-2.5 14.2 0 17" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4 text-[#c2410c]" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.8 2.5 14.2 0 17M12 3.5c-2.5 2.8-2.5 14.2 0 17" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <circle cx="16.5" cy="9" r="2.5" />
      <path d="M3.5 18.5c1.2-3 3.4-4.5 5.5-4.5s4.3 1.5 5.5 4.5M14 14c1.7 0 3.4 1 4.5 3.5" strokeLinecap="round" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
      <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
