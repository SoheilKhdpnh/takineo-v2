"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { StudentProfileForm } from "@/components/profiles/StudentProfileForm";
import {
  BookIcon,
  CameraIcon,
  CloseIcon,
  EarIcon,
  MicIcon,
  PathIcon,
  PencilIcon,
  PenIcon,
  TrophyIcon,
} from "@/components/ui/WorkspaceIcons";
import { Link, useRouter } from "@/i18n/navigation";
import type {
  EnglishLevel,
  ProfileLanguageCode,
  ProfileTimezone,
} from "@/lib/domain/profile";
import { ENGLISH_LEVELS } from "@/lib/domain/profile";
import {
  fileToProfilePhotoDataUrl,
  uploadProfilePhoto,
} from "@/lib/profile/profile-photo-client";
import { cn } from "@/lib/ui/cn";

export const STUDENT_DEFAULT_COVER = "/images/teacher-cover-default.png";

type ProfileTab = "overview" | "path" | "history" | "goals";

function levelIndex(level: EnglishLevel | null): number {
  if (!level) {
    return 0;
  }
  return ENGLISH_LEVELS.indexOf(level) + 1;
}

function ProgressRing({
  label,
  emptyLabel,
}: {
  label: string;
  emptyLabel: string;
}) {
  return (
    <div className="relative grid size-36 place-items-center sm:size-40">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke="#edddd4"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke="#fdba74"
          strokeWidth="10"
          strokeDasharray="301.6 301.6"
          strokeDashoffset="301.6"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl font-semibold tabular-nums text-zinc-400">—</p>
          <p className="mt-1 max-w-[6.5rem] text-[0.65rem] leading-4 font-medium text-zinc-500">
            {emptyLabel}
          </p>
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function StudentProfileOverview({
  userName,
  userImage,
  profile,
  children,
}: {
  userName: string;
  userImage: string | null;
  profile: {
    englishLevel: EnglishLevel | null;
    learningGoal: string | null;
    nativeLanguage: ProfileLanguageCode;
    timezone: ProfileTimezone;
    createdAt: Date | string;
    profileCompletedAt: Date | string | null;
  };
  children?: ReactNode;
}) {
  const t = useTranslations("StudentProfile");
  const common = useTranslations("ProfileCommon");
  const locale = useLocale();
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<ProfileTab>("overview");
  const [editorOpen, setEditorOpen] = useState(false);
  const [image, setImage] = useState<string | null>(userImage);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const displayName =
    userName.trim().length > 0 ? userName.trim() : t("nameFallback");

  useEffect(() => {
    setImage(userImage);
  }, [userImage]);

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setPhotoBusy(true);
    setPhotoError(null);

    try {
      const dataUrl = await fileToProfilePhotoDataUrl(file);
      const nextImage = await uploadProfilePhoto(dataUrl);
      setImage(nextImage);
      router.refresh();
    } catch (error) {
      if (error instanceof Error && error.message === "TOO_LARGE") {
        setPhotoError(t("photoErrors.tooLarge"));
      } else if (error instanceof Error && error.message === "UNAUTHORIZED") {
        setPhotoError(t("photoErrors.unauthorized"));
      } else if (error instanceof Error && error.message === "INVALID_TYPE") {
        setPhotoError(t("photoErrors.invalidType"));
      } else if (
        error instanceof Error &&
        (error.message === "FORBIDDEN" || error.message === "INVALID_PHOTO")
      ) {
        setPhotoError(t("photoErrors.generic"));
      } else {
        setPhotoError(t("photoErrors.generic"));
      }
    } finally {
      setPhotoBusy(false);
    }
  }

  function openPhotoPicker() {
    photoInputRef.current?.click();
  }
  const joinedLabel = useMemo(() => {
    const date =
      typeof profile.createdAt === "string"
        ? new Date(profile.createdAt)
        : profile.createdAt;
    return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
      month: "short",
      year: "numeric",
      timeZone: "Asia/Tehran",
    }).format(date);
  }, [locale, profile.createdAt]);

  const level = profile.englishLevel;
  const levelNumber = levelIndex(level);
  const levelProgress = level ? (levelNumber / ENGLISH_LEVELS.length) * 100 : 0;

  const skills = [
    { key: "speaking", Icon: MicIcon, wave4: true },
    { key: "listening", Icon: EarIcon, wave4: false },
    { key: "grammar", Icon: PenIcon, wave4: true },
    { key: "vocabulary", Icon: BookIcon, wave4: true },
    { key: "writing", Icon: PencilIcon, wave4: false },
    { key: "pronunciation", Icon: MicIcon, wave4: true },
  ] as const;

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: "overview", label: t("tabOverview") },
    { id: "path", label: t("tabPath") },
    { id: "history", label: t("tabHistory") },
    { id: "goals", label: t("tabGoals") },
  ];

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[1.75rem] border border-[#edddd4] bg-white shadow-[0_24px_60px_-42px_rgba(28,20,16,0.45)]">
        <div className="relative h-40 sm:h-52">
          <Image
            src={STUDENT_DEFAULT_COVER}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 70vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1c1410]/40 via-transparent to-transparent" />
          <div className="absolute end-4 top-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={photoBusy}
              onClick={openPhotoPicker}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/90 px-3 text-sm font-semibold text-zinc-800 shadow-sm backdrop-blur transition hover:bg-white disabled:opacity-60"
            >
              <CameraIcon className="size-4" />
              {t("changePhoto")}
            </button>
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/90 px-3 text-sm font-semibold text-zinc-800 shadow-sm backdrop-blur transition hover:bg-white"
            >
              <PencilIcon className="size-4" />
              {t("editProfile")}
            </button>
          </div>
        </div>

        <div className="relative px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-col gap-5 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="relative size-24 shrink-0 sm:size-28">
                <span className="grid size-full place-items-center overflow-hidden rounded-full border-4 border-white bg-[#fff4ed] text-3xl font-semibold text-[#c2410c] shadow-sm">
                  {image ? (
                    // Profile photos are stored as data URLs or provider URLs.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
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
                  aria-label={t("changePhoto")}
                  disabled={photoBusy}
                  onClick={openPhotoPicker}
                  className="absolute bottom-0.5 end-0.5 z-10 grid size-9 place-items-center rounded-full border-2 border-white bg-[#c2410c] text-white shadow transition hover:bg-[#9a3412] disabled:opacity-60"
                >
                  <CameraIcon className="size-4" />
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  className="sr-only"
                  onChange={(event) => void handlePhotoChange(event)}
                />
              </div>

              <div className="min-w-0 pb-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.7rem] font-semibold tracking-[0.22em] text-[#c2410c] uppercase">
                      {t("nameEyebrow")}
                    </p>
                    <h1 className="font-display mt-1 text-3xl leading-none font-bold tracking-[-0.03em] text-[#1c1410] sm:text-4xl">
                      <span className="bg-[linear-gradient(180deg,#1c1410_0%,#7c2d12_100%)] bg-clip-text text-transparent">
                        {displayName}
                      </span>
                    </h1>
                    <span
                      aria-hidden="true"
                      className="mt-2 block h-1 w-16 rounded-full bg-[linear-gradient(90deg,#c2410c,#fdba74)]"
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={t("editProfile")}
                    onClick={() => setEditorOpen(true)}
                    className="grid size-9 place-items-center rounded-xl border border-[#edddd4] bg-white text-[#c2410c] shadow-sm transition hover:bg-[#fff4ed]"
                  >
                    <PencilIcon className="size-4" />
                  </button>
                  {level ? (
                    <span className="inline-flex items-center rounded-full bg-[#fff4ed] px-2.5 py-1 text-xs font-semibold text-[#9a3412]">
                      {t(`levels.${level}`)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                  {profile.learningGoal?.trim() || t("bioFallback")}
                </p>
                {photoBusy ? (
                  <p className="mt-2 text-xs font-medium text-[#c2410c]">
                    {t("photoUploading")}
                  </p>
                ) : null}
                {photoError ? (
                  <p role="alert" className="mt-2 text-xs font-medium text-red-700">
                    {photoError}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 border-t border-[#edddd4] pt-5 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold tracking-wide text-[#c2410c] uppercase">
                {t("metaJoined")}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {joinedLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-[#c2410c] uppercase">
                {t("metaGoal")}
              </dt>
              <dd className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-900">
                {profile.learningGoal?.trim() || t("notProvided")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-[#c2410c] uppercase">
                {t("metaLanguage")}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {common(`languages.${profile.nativeLanguage}`)}
                <span className="mx-1.5 text-zinc-300">·</span>
                <span dir="ltr">{profile.timezone}</span>
              </dd>
            </div>
          </dl>
        </div>
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

          {tab === "overview" ? (
            <div id="progress" className="mt-6 scroll-mt-24 space-y-8">
              <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
                <ProgressRing
                  label={t("overallProgress")}
                  emptyLabel={t("progressEmpty")}
                />
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">
                    {t("currentLevel")}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    {level
                      ? t("levelOf", {
                          label: t(`levels.${level}`),
                          current: levelNumber,
                          total: ENGLISH_LEVELS.length,
                        })
                      : t("levelUnknown")}
                  </p>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#fff4ed]">
                    <div
                      className="h-full rounded-full bg-[#c2410c] transition-all"
                      style={{ width: `${levelProgress}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    {t("progressWave4Note")}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-zinc-950">
                  {t("skillsHeading")}
                </h3>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {skills.map(({ key, Icon, wave4 }) => (
                    <li
                      key={key}
                      className="rounded-2xl border border-[#edddd4] bg-[#fffaf6] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-xl bg-[#fff4ed] text-[#c2410c]">
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900">
                            {t(`skills.${key}`)}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {wave4 ? t("skillAwaiting") : t("skillNotTracked")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-[#edddd4]">
                        <div className="h-full w-0 rounded-full bg-[#c2410c]" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div id="learning-path" className="scroll-mt-24">
                <h3 className="text-sm font-semibold text-zinc-950">
                  {t("recentActivity")}
                </h3>
                <div className="mt-3 rounded-2xl border border-dashed border-[#e7c9b6] bg-[#fffaf6] px-4 py-6 text-sm leading-6 text-zinc-600">
                  {t("activityEmpty")}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "path" ? (
            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-[#fff4ed] text-[#c2410c]">
                  <PathIcon />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">
                    {t("pathTitle")}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    {t("pathBody")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "history" ? (
            <div className="mt-6 space-y-4">
              <h2 className="text-lg font-semibold text-zinc-950">
                {t("historyTitle")}
              </h2>
              <p className="text-sm leading-6 text-zinc-600">{t("historyBody")}</p>
              <div className="rounded-2xl border border-dashed border-[#e7c9b6] bg-[#fffaf6] px-4 py-6 text-sm text-zinc-600">
                {t("historyEmpty")}
              </div>
            </div>
          ) : null}

          {tab === "goals" ? (
            <div className="mt-6 space-y-4">
              <h2 className="text-lg font-semibold text-zinc-950">
                {t("goalsTitle")}
              </h2>
              {profile.learningGoal?.trim() ? (
                <article className="rounded-2xl border border-[#edddd4] bg-[#fffaf6] p-4">
                  <p className="text-sm font-semibold text-zinc-900">
                    {profile.learningGoal.trim()}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">{t("goalFromProfile")}</p>
                </article>
              ) : (
                <p className="rounded-2xl border border-dashed border-[#e7c9b6] bg-[#fffaf6] px-4 py-6 text-sm text-zinc-600">
                  {t("goalsEmpty")}
                </p>
              )}
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[#edddd4] bg-white p-5">
            <h3 className="text-sm font-semibold text-zinc-950">
              {t("goalsAsideTitle")}
            </h3>
            {profile.learningGoal?.trim() ? (
              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-600">
                    <span className="line-clamp-1">
                      {profile.learningGoal.trim()}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#fff4ed]">
                    <div className="h-full w-0 rounded-full bg-[#c2410c]" />
                  </div>
                </div>
                <p className="text-xs leading-5 text-zinc-500">
                  {t("goalsAsideHint")}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {t("goalsEmpty")}
              </p>
            )}
          </div>

          <div
            id="sessions"
            className="scroll-mt-24 rounded-2xl border border-[#edddd4] bg-[#c2410c] p-5 text-white"
          >
            <p className="text-sm font-semibold">{t("nextSessionTitle")}</p>
            <p className="mt-2 text-sm leading-6 text-white/85">
              {t("nextSessionBody")}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href="#student-sessions"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-[#c2410c] transition hover:bg-[#fff4ed]"
              >
                {t("viewSessions")}
              </a>
              <Link
                href="/teachers"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/30 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {t("findTeacher")}
              </Link>
            </div>
          </div>

          <div
            id="vocabulary"
            className="scroll-mt-24 rounded-2xl border border-[#edddd4] bg-white p-5"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-[#fff4ed] text-[#c2410c]">
                <TrophyIcon />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-zinc-950">
                  {t("insightsTitle")}
                </h3>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  {t("insightsBody")}
                </p>
              </div>
            </div>
          </div>

          <div className="relative isolate overflow-hidden rounded-2xl border border-[#edddd4] p-5 text-white">
            <Image
              src="/images/teacher-journey-mountain.png"
              alt=""
              fill
              sizes="20rem"
              className="-z-10 object-cover"
            />
            <div className="absolute inset-0 -z-10 bg-[#1c1410]/75" />
            <p className="text-sm font-semibold">{t("footerBannerTitle")}</p>
            <p className="mt-2 text-xs leading-5 text-white/80">
              {t("footerBannerBody")}
            </p>
          </div>
        </aside>
      </div>

      {children}

      {editorOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-edit-title"
          className="fixed inset-0 z-50 grid place-items-end bg-[#1c1410]/45 p-3 backdrop-blur-[2px] sm:place-items-center sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setEditorOpen(false);
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-[#edddd4] bg-[#fffaf6] shadow-[0_40px_120px_-40px_rgba(28,20,16,0.6)]">
            <header className="flex items-start justify-between gap-4 border-b border-[#edddd4] bg-white px-5 py-4">
              <div>
                <h2
                  id="student-edit-title"
                  className="text-lg font-semibold text-zinc-950"
                >
                  {t("editorTitle")}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {t("editorDescription")}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("editorClose")}
                onClick={() => setEditorOpen(false)}
                className="grid size-9 place-items-center rounded-xl text-zinc-500 hover:bg-[#fff4ed]"
              >
                <CloseIcon />
              </button>
            </header>
            <div className="p-5">
              <StudentProfileForm
                initialValue={{
                  englishLevel: profile.englishLevel,
                  learningGoal: profile.learningGoal ?? "",
                  nativeLanguage: profile.nativeLanguage,
                  timezone: profile.timezone,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
