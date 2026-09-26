"use client";

import { useTranslations } from "next-intl";

import type { PublicTeacherDiscoveryItem } from "@/components/teachers/teacher-discovery-api";
import { Avatar } from "@/components/ui/Avatar";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/ui/cn";

export function TeacherCard({
  teacher,
  nextAvailableLabel,
  className,
}: {
  teacher: PublicTeacherDiscoveryItem;
  nextAvailableLabel: string | null;
  className?: string;
}) {
  const t = useTranslations("TeacherDiscovery");
  const common = useTranslations("ProfileCommon");
  const profileHref = `/teachers/${teacher.teacherProfileId}`;

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-[#edddd4] bg-white shadow-[0_18px_40px_-34px_rgba(28,20,16,0.45)]",
        className,
      )}
    >
      <div className="flex items-start gap-3 px-5 pt-5">
        <Avatar
          name={teacher.name}
          image={teacher.image}
          size="md"
          className="rounded-full bg-[#fff4ed] text-[#c2410c]"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="flex min-w-0 items-center gap-1.5 text-base font-semibold text-[#1c1410]">
                <span className="truncate">{teacher.name}</span>
                <VerifiedIcon />
              </h3>
              <p className="mt-0.5 text-sm text-zinc-500">
                {t("tutorRole", {
                  language: common(`languages.${teacher.teachingLanguage}`),
                })}
              </p>
            </div>
          </div>

          <dl className="mt-3 space-y-1.5 text-sm text-zinc-700">
            {teacher.experienceYears !== null ? (
              <div className="flex items-center gap-2">
                <StarIcon />
                <dt className="sr-only">{t("experienceLabel")}</dt>
                <dd>
                  {t("experienceYears", {
                    years: teacher.experienceYears,
                  })}
                </dd>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="inline-flex items-center gap-1.5">
                <LanguageIcon />
                <dt className="sr-only">{t("teachingLanguage")}</dt>
                <dd>{common(`languages.${teacher.teachingLanguage}`)}</dd>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <ClockIcon />
                <dt className="sr-only">{t("nextAvailability")}</dt>
                <dd className="font-medium text-[#9a3412]">
                  {nextAvailableLabel ?? t("noAvailabilityShort")}
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </div>

      <p className="mt-4 line-clamp-3 flex-1 px-5 text-sm leading-6 text-zinc-600">
        {teacher.headline?.trim() || t("headlineFallback")}
      </p>

      <Link
        href={profileHref}
        className="group relative mx-5 mt-4 block overflow-hidden rounded-2xl bg-[#fff4ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c2410c]"
      >
        <div className="relative aspect-[16/10]">
          {teacher.image ? (
            // Discovery photos may come from arbitrary Better Auth image URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={teacher.image}
              alt=""
              className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#fff4ed_0%,#fdba74_45%,#c2410c_100%)]" />
          )}
          <div className="absolute inset-0 bg-[#1c1410]/25 transition group-hover:bg-[#1c1410]/35" />
          <span className="absolute start-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide text-[#9a3412] uppercase">
            {t("introBadge")}
          </span>
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-12 place-items-center rounded-full bg-white/95 text-[#c2410c] shadow-lg transition group-hover:scale-105">
              <PlayIcon />
            </span>
          </span>
        </div>
        <span className="sr-only">{t("openIntroduction")}</span>
      </Link>

      <div className="p-5 pt-4">
        <Link
          href={profileHref}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#c2410c] px-4 text-sm font-semibold text-white transition hover:bg-[#9a3412]"
        >
          {t("bookTrial")}
        </Link>
      </div>
    </article>
  );
}

function VerifiedIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4 shrink-0 text-[#c2410c]"
      aria-hidden="true"
    >
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
  );
}

function StarIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4 shrink-0 text-[#ea580c]"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M10 2.4 12.1 7l5 .5-3.8 3.3 1.2 4.9L10 13.8 5.5 15.7l1.2-4.9L2.9 7.5 7.9 7z"
      />
    </svg>
  );
}

function LanguageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-4 shrink-0 text-zinc-400"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.8 2.5 14.2 0 17M12 3.5c-2.5 2.8-2.5 14.2 0 17" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-4 shrink-0 text-zinc-400"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="currentColor" d="M9.2 7.2v9.6L17.2 12z" />
    </svg>
  );
}
