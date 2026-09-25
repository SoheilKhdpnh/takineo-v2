"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";

import {
  TEACHER_DEFAULT_COVER,
  TeacherProfileEditDialog,
  type TeacherProfileEditSection,
} from "@/components/teacher/TeacherProfileEditDialog";
import {
  CameraIcon,
  PencilIcon,
} from "@/components/ui/WorkspaceIcons";
import { Link } from "@/i18n/navigation";
import type {
  ProfileLanguageCode,
  ProfileTimezone,
} from "@/lib/domain/profile";
import type { TeacherApplicationStatus } from "@/lib/domain/teacher-application";
import { cn } from "@/lib/ui/cn";

type ProfileTab = "about" | "experience" | "education" | "certifications";

const applicationStatusKeys = {
  DRAFT: "statusDraft",
  PENDING_REVIEW: "statusPendingReview",
  APPROVED: "statusApproved",
  REJECTED: "statusRejected",
  SUSPENDED: "statusSuspended",
} as const;

const videoStatusKeys = {
  missing: "videoMissing",
  UPLOAD_PENDING: "videoMissing",
  PROCESSING: "videoProcessing",
  READY_FOR_REVIEW: "videoReview",
  APPROVED: "videoApproved",
  REJECTED: "videoRejected",
  FAILED: "videoFailed",
} as const;

export function TeacherProfileOverview({
  userName,
  userImage,
  profile,
  showEditor,
  children,
}: {
  userName: string;
  userImage: string | null;
  showEditor: boolean;
  children?: ReactNode;
  profile: {
    headline: string | null;
    bio: string | null;
    experienceYears: number | null;
    nativeLanguage: ProfileLanguageCode;
    teachingLanguage: string;
    timezone: ProfileTimezone;
    applicationStatus: TeacherApplicationStatus;
    introVideoStatus: keyof typeof videoStatusKeys | null;
  };
}) {
  const t = useTranslations("TeacherProfile");
  const common = useTranslations("ProfileCommon");
  const [tab, setTab] = useState<ProfileTab>("about");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSection, setEditorSection] =
    useState<TeacherProfileEditSection>("details");

  function openEditor(section: TeacherProfileEditSection) {
    setEditorSection(section);
    setEditorOpen(true);
  }

  const displayName =
    userName.trim().length > 0 ? userName.trim() : t("nameFallback");

  const bioParts = useMemo(() => {
    const raw = profile.bio?.trim() ?? "";
    if (!raw) {
      return { about: null, experience: null };
    }

    const chunks = raw
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      about: chunks[0] ?? raw,
      experience: chunks.slice(1).join("\n\n") || null,
    };
  }, [profile.bio]);

  const languages = [
    common(`languages.${profile.nativeLanguage}`),
    profile.teachingLanguage === "en"
      ? common("languages.en")
      : profile.teachingLanguage,
  ].filter((value, index, list) => list.indexOf(value) === index);

  const stats = [
    {
      label: t("statExperience"),
      value:
        profile.experienceYears === null
          ? t("notProvided")
          : t("statExperienceValue", {
              years: profile.experienceYears,
            }),
      hint: t("statExperienceHint"),
    },
    {
      label: t("statApplication"),
      value: t(applicationStatusKeys[profile.applicationStatus]),
      hint: t("statApplicationHint"),
    },
    {
      label: t("statVideo"),
      value: t(
        videoStatusKeys[profile.introVideoStatus ?? "missing"],
      ),
      hint: t("statVideoHint"),
    },
    {
      label: t("statTeaching"),
      value:
        profile.teachingLanguage === "en"
          ? common("languages.en")
          : profile.teachingLanguage,
      hint: t("statTeachingHint"),
    },
  ];

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: "about", label: t("tabAbout") },
    { id: "experience", label: t("tabExperience") },
    { id: "education", label: t("tabEducation") },
    { id: "certifications", label: t("tabCertifications") },
  ];

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[1.75rem] border border-[#edddd4] bg-white shadow-[0_24px_60px_-42px_rgba(28,20,16,0.45)]">
        <div className="relative h-44 sm:h-60">
          <Image
            src={TEACHER_DEFAULT_COVER}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 70vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1c1410]/35 via-transparent to-transparent" />
          <button
            type="button"
            onClick={() => openEditor("photos")}
            className="absolute end-4 top-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/85 px-3 text-sm font-semibold text-zinc-800 shadow-sm backdrop-blur transition hover:bg-white"
          >
            <CameraIcon className="size-4" />
            {t("changeCoverPhoto")}
          </button>
        </div>

        <div className="relative px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-col gap-5 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="relative size-24 shrink-0 sm:size-28">
                <span className="grid size-full place-items-center overflow-hidden rounded-full border-4 border-white bg-[#fff4ed] text-3xl font-semibold text-[#c2410c] shadow-sm">
                  {userImage ? (
                    // Better Auth profile images may come from arbitrary provider URLs.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={userImage}
                      alt=""
                      width={112}
                      height={112}
                      className="size-full object-cover"
                    />
                  ) : (
                    displayName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <button
                  type="button"
                  aria-label={t("changeProfilePhoto")}
                  onClick={() => openEditor("photos")}
                  className="absolute bottom-0.5 end-0.5 grid size-9 place-items-center rounded-full border-2 border-white bg-[#c2410c] text-white shadow transition hover:bg-[#9a3412]"
                >
                  <CameraIcon className="size-4" />
                </button>
              </div>

              <div className="min-w-0 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
                    {displayName}
                  </h1>
                  {profile.applicationStatus === "APPROVED" ? (
                    <span className="inline-flex items-center rounded-full bg-[#fff4ed] px-2.5 py-1 text-xs font-semibold text-[#9a3412]">
                      {t("verifiedBadge")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
                  {profile.headline?.trim() || t("headlineFallback")}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-zinc-500">
                  <span dir="ltr">{profile.timezone}</span>
                  <span>
                    {profile.experienceYears === null
                      ? t("notProvided")
                      : t("metaExperience", {
                          years: profile.experienceYears,
                        })}
                  </span>
                  <span>{languages.join(" · ")}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openEditor("details")}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#c2410c] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_-16px_rgba(194,65,12,0.95)] transition hover:bg-[#9a3412]"
            >
              <PencilIcon className="size-4" />
              {t("editProfile")}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border border-[#edddd4] bg-white p-5"
          >
            <p className="text-xs font-semibold tracking-wide text-[#c2410c] uppercase">
              {stat.label}
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
              {stat.value}
            </p>
            <p className="mt-2 text-sm text-zinc-500">{stat.hint}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-2xl border border-[#edddd4] bg-white p-5 sm:p-6">
          <div
            role="tablist"
            aria-label={t("tabsLabel")}
            className="flex gap-1 overflow-x-auto border-b border-[#edddd4] pb-px"
          >
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative shrink-0 px-3 py-3 text-sm font-semibold transition",
                  tab === item.id
                    ? "text-[#c2410c]"
                    : "text-zinc-500 hover:text-zinc-800",
                )}
              >
                {item.label}
                {tab === item.id ? (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#c2410c]" />
                ) : null}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(14rem,0.8fr)]">
            <div>
              {tab === "about" ? (
                <>
                  <h2 className="text-lg font-semibold text-zinc-950">
                    {t("tabAbout")}
                  </h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-600">
                    {bioParts.about ?? t("aboutEmpty")}
                  </p>
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-zinc-950">
                      {t("languagesHeading")}
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {languages.map((language) => (
                        <span
                          key={language}
                          className="rounded-full border border-[#edddd4] bg-[#fffaf6] px-3 py-1.5 text-xs font-semibold text-[#9a3412]"
                        >
                          {language}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {tab === "experience" ? (
                <>
                  <h2 className="text-lg font-semibold text-zinc-950">
                    {t("tabExperience")}
                  </h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-600">
                    {bioParts.experience ??
                      (bioParts.about
                        ? t("experienceFromBio")
                        : t("experienceEmpty"))}
                  </p>
                </>
              ) : null}

              {tab === "education" ? (
                <>
                  <h2 className="text-lg font-semibold text-zinc-950">
                    {t("tabEducation")}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-600">
                    {t("educationEmpty")}
                  </p>
                </>
              ) : null}

              {tab === "certifications" ? (
                <>
                  <h2 className="text-lg font-semibold text-zinc-950">
                    {t("tabCertifications")}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-600">
                    {t("certificationsEmpty")}
                  </p>
                </>
              ) : null}
            </div>

            <aside className="rounded-2xl border border-[#edddd4] bg-[#fffaf6] p-4">
              <h3 className="text-sm font-semibold text-zinc-950">
                {t("highlightsHeading")}
              </h3>
              <ul className="mt-3 space-y-2.5 text-sm leading-6 text-zinc-600">
                <li className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#c2410c]" />
                  {t("highlightSessions")}
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#c2410c]" />
                  {t("highlightHuman")}
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#c2410c]" />
                  {t("highlightTimezone", { timezone: profile.timezone })}
                </li>
              </ul>
              <p className="mt-4 rounded-xl bg-[#fff4ed] px-3 py-2.5 text-xs leading-5 text-[#9a3412]">
                {t("highlightNote")}
              </p>
            </aside>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[#edddd4] bg-[#c2410c] p-5 text-white">
            <p className="text-sm font-semibold">{t("availabilityTitle")}</p>
            <p className="mt-2 text-sm leading-6 text-white/85">
              {t("availabilityBody")}
            </p>
            <a
              href="#schedule"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-[#c2410c] transition hover:bg-[#fff4ed]"
            >
              {t("setAvailability")}
            </a>
          </div>

          <div className="rounded-2xl border border-[#edddd4] bg-white p-5">
            <h3 className="text-sm font-semibold text-zinc-950">
              {t("quickActions")}
            </h3>
            <div className="mt-3 flex flex-col gap-2">
              <a
                href="#schedule"
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-[#fff4ed] hover:text-[#9a3412]"
              >
                {t("actionAvailability")}
              </a>
              <Link
                href="/teacher/video"
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-[#fff4ed] hover:text-[#9a3412]"
              >
                {t("actionVideo")}
              </Link>
              <button
                type="button"
                onClick={() => openEditor("details")}
                className="rounded-xl px-3 py-2.5 text-start text-sm font-medium text-zinc-700 transition hover:bg-[#fff4ed] hover:text-[#9a3412]"
              >
                {t("actionEdit")}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#edddd4] bg-[#1c1410] p-5 text-[#fffaf6]">
            <p className="text-sm font-semibold">{t("growthTitle")}</p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              {t("growthBody")}
            </p>
          </div>
        </aside>
      </div>

      {children}

      <TeacherProfileEditDialog
        open={editorOpen}
        focusSection={editorSection}
        onClose={() => setEditorOpen(false)}
        displayName={displayName}
        userImage={userImage}
        canEditDetails={showEditor}
        initialValue={{
          headline: profile.headline ?? "",
          bio: profile.bio ?? "",
          experienceYears: profile.experienceYears,
          nativeLanguage: profile.nativeLanguage,
          timezone: profile.timezone,
        }}
      />
    </div>
  );
}
