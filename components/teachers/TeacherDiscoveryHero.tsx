"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  useId,
  useState,
  type FormEvent,
} from "react";

import type { ProfileLanguageCode } from "@/lib/domain/profile";
import { cn } from "@/lib/ui/cn";

export const TEACHER_DISCOVERY_HERO =
  "/images/teacher-cover-default.png";

const SUBJECT_OPTIONS = ["english"] as const;

type SubjectOption = (typeof SUBJECT_OPTIONS)[number];

export function TeacherDiscoveryHero({
  nativeFilter,
  nativeOptions,
  onSearch,
}: {
  nativeFilter: ProfileLanguageCode | "all";
  nativeOptions: ProfileLanguageCode[];
  onSearch: (input: {
    subject: SubjectOption;
    nativeLanguage: ProfileLanguageCode | "all";
  }) => void;
}) {
  const t = useTranslations("TeacherDiscovery");
  const common = useTranslations("ProfileCommon");
  const subjectId = useId();
  const languageId = useId();
  const [subject, setSubject] = useState<SubjectOption>("english");
  const [nativeLanguage, setNativeLanguage] = useState<
    ProfileLanguageCode | "all"
  >(nativeFilter);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch({ subject, nativeLanguage });
  }

  return (
    <section className="relative isolate overflow-hidden bg-[#1c1410]">
      <Image
        src={TEACHER_DISCOVERY_HERO}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_30%]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(28,20,16,0.78)_0%,rgba(28,20,16,0.45)_48%,rgba(28,20,16,0.2)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(28,20,16,0.35)_0%,transparent_35%,rgba(28,20,16,0.55)_100%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col justify-end px-4 pb-8 pt-20 sm:px-6 sm:pb-10 sm:pt-28 lg:pt-36">
        <div className="max-w-xl text-white">
          <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-[-0.03em] sm:text-5xl lg:text-[3.25rem]">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-white/85 sm:text-lg">
            {t("heroDescription")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 w-full max-w-4xl rounded-2xl bg-white p-2 shadow-[0_24px_60px_-28px_rgba(28,20,16,0.55)] sm:rounded-full sm:p-1.5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label
              htmlFor={subjectId}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 sm:rounded-full sm:px-4"
            >
              <BookMarkIcon />
              <span className="sr-only">{t("searchSubjectLabel")}</span>
              <select
                id={subjectId}
                value={subject}
                onChange={(event) =>
                  setSubject(event.target.value as SubjectOption)
                }
                className="w-full min-w-0 appearance-none bg-transparent text-sm font-medium text-zinc-800 outline-none"
              >
                {SUBJECT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`subjects.${option}`)}
                  </option>
                ))}
              </select>
              <ChevronIcon />
            </label>

            <span
              aria-hidden="true"
              className="hidden h-8 w-px bg-[#edddd4] sm:block"
            />

            <label
              htmlFor={languageId}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 sm:rounded-full sm:px-4"
            >
              <GlobeIcon />
              <span className="sr-only">{t("searchLanguageLabel")}</span>
              <select
                id={languageId}
                value={nativeLanguage}
                onChange={(event) =>
                  setNativeLanguage(
                    event.target.value as ProfileLanguageCode | "all",
                  )
                }
                className="w-full min-w-0 appearance-none bg-transparent text-sm font-medium text-zinc-800 outline-none"
              >
                <option value="all">{t("anyLanguage")}</option>
                {nativeOptions.map((code) => (
                  <option key={code} value={code}>
                    {common(`languages.${code}`)}
                  </option>
                ))}
              </select>
              <ChevronIcon />
            </label>

            <button
              type="submit"
              className={cn(
                "inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-[#c2410c] px-7 text-sm font-semibold text-white transition hover:bg-[#9a3412]",
                "sm:rounded-full",
              )}
            >
              {t("search")}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function BookMarkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-5 shrink-0 text-[#c2410c]"
      aria-hidden="true"
    >
      <path
        d="M6.5 4.5h9A2.5 2.5 0 0 1 18 7v12.5l-5.5-3-5.5 3V7A2.5 2.5 0 0 1 6.5 4.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-5 shrink-0 text-[#c2410c]"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.8 2.5 14.2 0 17M12 3.5c-2.5 2.8-2.5 14.2 0 17" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-4 shrink-0 text-zinc-400"
      aria-hidden="true"
    >
      <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
