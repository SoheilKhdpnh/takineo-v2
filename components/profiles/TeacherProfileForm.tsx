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
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import {
  PROFILE_LANGUAGE_CODES,
  type ProfileLanguageCode,
  type ProfileTimezone,
} from "@/lib/domain/profile";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/ui/cn";

interface TeacherProfileFormProps {
  displayName: string;
  image: string | null;
  initialValue: {
    headline: string;
    bio: string;
    experienceYears: number | null;
    nativeLanguage: ProfileLanguageCode;
    timezone: ProfileTimezone;
  };
}

export function TeacherProfileForm({
  displayName,
  image,
  initialValue,
}: TeacherProfileFormProps) {
  const router = useRouter();
  const t = useTranslations("TeacherProfile");
  const common = useTranslations("ProfileCommon");
  const [headline, setHeadline] = useState(initialValue.headline);
  const [bio, setBio] = useState(initialValue.bio);
  const [experienceYears, setExperienceYears] = useState(
    String(initialValue.experienceYears ?? 0),
  );
  const [nativeLanguage, setNativeLanguage] = useState(initialValue.nativeLanguage);
  const [timezone, setTimezone] = useState(initialValue.timezone);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedExperience = Number(experienceYears);
  const completeness = useMemo(() => {
    const checks = [
      headline.trim().length >= 10,
      bio.trim().length >= 80,
      Number.isInteger(parsedExperience) && parsedExperience >= 0,
      Boolean(nativeLanguage),
      Boolean(timezone),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [bio, headline, nativeLanguage, parsedExperience, timezone]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/profile/teacher", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: headline.trim(),
          bio: bio.trim(),
          experienceYears: parsedExperience,
          nativeLanguage,
          teachingLanguage: "en",
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

      router.replace("/teacher/dashboard");
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
            id: "teacher-about",
            label: t("navAbout"),
            complete: Boolean(nativeLanguage && timezone),
          },
          {
            id: "teacher-headline",
            label: t("navHeadline"),
            complete: headline.trim().length >= 10,
          },
          {
            id: "teacher-bio",
            label: t("navBio"),
            complete: bio.trim().length >= 80,
          },
          {
            id: "teacher-experience",
            label: t("navExperience"),
            complete: Number.isInteger(parsedExperience) && parsedExperience >= 0,
          },
        ]}
        preview={
          <ProfilePreviewCard title={t("previewTitle")}>
            <div className="flex items-start gap-3">
              <Avatar name={displayName} image={image} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{displayName}</p>
                <p className="mt-1 text-sm leading-6 text-ink-muted">
                  {headline.trim() || t("previewHeadlineEmpty")}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>
                {t("previewNative")}: {common(`languages.${nativeLanguage}`)}
              </Badge>
              <Badge tone="mint">
                {t("previewTeaching")}: {common("languages.en")}
              </Badge>
            </div>
            <p className="mt-4 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-ink">
              {bio.trim() || t("previewBioEmpty")}
            </p>
            <p className="mt-4 text-xs font-medium text-ink-muted">
              {t("previewExperience", { years: Number.isFinite(parsedExperience) ? parsedExperience : 0 })}{" "}
              · {common(PROFILE_TIMEZONE_LABEL_KEYS[timezone])}
            </p>
          </ProfilePreviewCard>
        }
      >
        <div className="space-y-6">
          <ProfileSection
            id="teacher-about"
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
            <p className="mt-5 rounded-md bg-mint px-4 py-3 text-sm leading-6 text-ink">
              {t("teachingLanguageFixed")}
            </p>
          </ProfileSection>

          <ProfileSection
            id="teacher-headline"
            title={t("sectionHeadline")}
            hint={t("headlineHint")}
            audienceLabel={common("studentsSeeThis")}
          >
            <label className="block space-y-2" htmlFor="headline">
              <span className="text-sm font-semibold text-ink">{t("headline")}</span>
              <input
                id="headline"
                name="headline"
                type="text"
                required
                minLength={10}
                maxLength={120}
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                placeholder={t("headlinePlaceholder")}
                className={fieldClassName()}
              />
            </label>
            <p className="mt-2 text-xs font-medium text-ink-muted" dir="ltr">
              {headline.trim().length}/120
            </p>
          </ProfileSection>

          <ProfileSection
            id="teacher-bio"
            title={t("sectionBio")}
            hint={t("bioHint")}
            audienceLabel={common("studentsSeeThis")}
          >
            <label className="block space-y-2" htmlFor="bio">
              <span className="text-sm font-semibold text-ink">{t("bio")}</span>
              <textarea
                id="bio"
                name="bio"
                required
                minLength={80}
                maxLength={2000}
                rows={9}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder={t("bioPlaceholder")}
                className={fieldClassName(true)}
              />
            </label>
            <p className="mt-2 text-xs font-medium text-ink-muted" dir="ltr">
              {bio.trim().length}/2000
            </p>
          </ProfileSection>

          <ProfileSection
            id="teacher-experience"
            title={t("sectionExperience")}
            hint={t("experienceHint")}
            audienceLabel={common("studentsSeeThis")}
          >
            <label className="block max-w-xs space-y-2" htmlFor="experienceYears">
              <span className="text-sm font-semibold text-ink">
                {t("experienceYears")}
              </span>
              <input
                id="experienceYears"
                name="experienceYears"
                type="number"
                dir="ltr"
                required
                min={0}
                max={60}
                step={1}
                value={experienceYears}
                onChange={(event) => setExperienceYears(event.target.value)}
                className={cn(fieldClassName(), "text-left")}
              />
            </label>
            <p className="mt-2 text-xs leading-5 text-ink-muted">
              {t("experienceHelp")}
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
