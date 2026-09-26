"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useMemo, useState } from "react";

import {
  PROFILE_TIMEZONE_LABEL_KEYS,
  ProfilePreviewCard,
  ProfileSaveBar,
  ProfileSection,
  ProfileTimezoneOptions,
  ProfileWorkspace,
  fieldClassName,
} from "@/components/profiles/ProfileWorkspace";
import { Avatar } from "@/components/ui/Avatar";
import {
  ENGLISH_LEVELS,
  PROFILE_LANGUAGE_CODES,
  type EnglishLevel,
  type ProfileLanguageCode,
  type ProfileTimezone,
} from "@/lib/domain/profile";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/ui/cn";

const LEVEL_COPY = {
  A1: { name: "levelA1Name", hint: "levelA1Hint" },
  A2: { name: "levelA2Name", hint: "levelA2Hint" },
  B1: { name: "levelB1Name", hint: "levelB1Hint" },
  B2: { name: "levelB2Name", hint: "levelB2Hint" },
  C1: { name: "levelC1Name", hint: "levelC1Hint" },
  C2: { name: "levelC2Name", hint: "levelC2Hint" },
} as const;

interface StudentProfileFormProps {
  displayName: string;
  image: string | null;
  initialValue: {
    englishLevel: EnglishLevel | null;
    learningGoal: string;
    nativeLanguage: ProfileLanguageCode;
    timezone: ProfileTimezone;
  };
}

export function StudentProfileForm({
  displayName,
  image,
  initialValue,
}: StudentProfileFormProps) {
  const router = useRouter();
  const t = useTranslations("StudentProfile");
  const common = useTranslations("ProfileCommon");
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel | "">(
    initialValue.englishLevel ?? "",
  );
  const [learningGoal, setLearningGoal] = useState(initialValue.learningGoal);
  const [nativeLanguage, setNativeLanguage] = useState(initialValue.nativeLanguage);
  const [timezone, setTimezone] = useState(initialValue.timezone);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const completeness = useMemo(() => {
    const checks = [
      Boolean(englishLevel),
      learningGoal.trim().length >= 10,
      Boolean(nativeLanguage),
      Boolean(timezone),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [englishLevel, learningGoal, nativeLanguage, timezone]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!englishLevel) {
      setError(t("selectLevel"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/profile/student", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          englishLevel,
          learningGoal: learningGoal.trim(),
          nativeLanguage,
          timezone,
        }),
      });

      if (response.status === 401) {
        router.push("/sign-in");
        router.refresh();
        return;
      }

      if (!response.ok) {
        setError(common("saveError"));
        return;
      }

      router.replace("/student/dashboard");
      await router.refresh();
    } catch {
      setError(common("networkError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <ProfileWorkspace
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        completenessLabel={t("completeness")}
        completeness={completeness}
        navLabel={t("navLabel")}
        nav={[
          {
            id: "student-about",
            label: t("navAbout"),
            complete: Boolean(nativeLanguage && timezone),
          },
          {
            id: "student-level",
            label: t("navLevel"),
            complete: Boolean(englishLevel),
          },
          {
            id: "student-goal",
            label: t("navGoal"),
            complete: learningGoal.trim().length >= 10,
          },
        ]}
        preview={
          <ProfilePreviewCard title={t("previewTitle")}>
            <div className="flex items-start gap-3">
              <Avatar name={displayName} image={image} className="rounded-full" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{displayName}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {englishLevel
                    ? t("previewLevel", {
                        level: englishLevel,
                        name: t(LEVEL_COPY[englishLevel].name),
                      })
                    : t("previewLevelEmpty")}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-ink">
              {learningGoal.trim() || t("previewGoalEmpty")}
            </p>
            <p className="mt-4 text-xs font-medium text-ink-muted">
              {common(`languages.${nativeLanguage}`)} ·{" "}
              {common(PROFILE_TIMEZONE_LABEL_KEYS[timezone])}
            </p>
          </ProfilePreviewCard>
        }
      >
        <div className="space-y-6">
          <ProfileSection
            id="student-about"
            title={t("sectionAbout")}
            hint={t("aboutHint")}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="nativeLanguage" className="text-sm font-semibold text-ink">
                  {common("nativeLanguage")}
                </label>
                <select
                  id="nativeLanguage"
                  name="nativeLanguage"
                  required
                  value={nativeLanguage}
                  onChange={(event) =>
                    setNativeLanguage(event.target.value as ProfileLanguageCode)
                  }
                  className={fieldClassName()}
                >
                  {PROFILE_LANGUAGE_CODES.map((code) => (
                    <option key={code} value={code}>
                      {common(`languages.${code}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="timezone" className="text-sm font-semibold text-ink">
                  {common("timezone")}
                </label>
                <select
                  id="timezone"
                  name="timezone"
                  required
                  dir="ltr"
                  value={timezone}
                  onChange={(event) =>
                    setTimezone(event.target.value as ProfileTimezone)
                  }
                  className={cn(fieldClassName(), "text-left")}
                >
                  <ProfileTimezoneOptions
                    labelFor={(zone) => common(PROFILE_TIMEZONE_LABEL_KEYS[zone])}
                  />
                </select>
                <p className="text-xs leading-5 text-ink-muted">{t("timezoneHint")}</p>
              </div>
            </div>
          </ProfileSection>

          <ProfileSection
            id="student-level"
            title={t("sectionLevel")}
            hint={t("levelHint")}
            audienceLabel={common("teachersSeeThis")}
          >
            <div
              role="radiogroup"
              aria-label={t("englishLevel")}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {ENGLISH_LEVELS.map((level) => {
                const selected = englishLevel === level;
                return (
                  <label
                    key={level}
                    className={cn(
                      "cursor-pointer rounded-md border px-4 py-4 text-start transition",
                      selected
                        ? "border-primary bg-mint"
                        : "border-line bg-canvas hover:border-primary",
                    )}
                  >
                    <input
                      type="radio"
                      name="englishLevel"
                      value={level}
                      checked={selected}
                      onChange={() => setEnglishLevel(level)}
                      className="sr-only"
                    />
                    <span className="font-display text-lg font-semibold text-ink" dir="ltr">
                      {level}
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-ink">
                      {t(LEVEL_COPY[level].name)}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-ink-muted">
                      {t(LEVEL_COPY[level].hint)}
                    </span>
                  </label>
                );
              })}
            </div>
          </ProfileSection>

          <ProfileSection
            id="student-goal"
            title={t("sectionGoal")}
            hint={t("goalHint")}
            audienceLabel={common("teachersSeeThis")}
          >
            <label className="block space-y-2" htmlFor="learningGoal">
              <span className="text-sm font-semibold text-ink">{t("learningGoal")}</span>
              <textarea
                id="learningGoal"
                name="learningGoal"
                required
                minLength={10}
                maxLength={500}
                rows={7}
                value={learningGoal}
                onChange={(event) => setLearningGoal(event.target.value)}
                placeholder={t("goalPlaceholder")}
                className={fieldClassName(true)}
              />
            </label>
            <p className="mt-2 text-xs font-medium text-ink-muted" dir="ltr">
              {learningGoal.trim().length}/500
            </p>
          </ProfileSection>

          {error ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <ProfileSaveBar
            label={isSubmitting ? common("saving") : common("save")}
            disabled={isSubmitting}
          />
        </div>
      </ProfileWorkspace>
    </form>
  );
}
