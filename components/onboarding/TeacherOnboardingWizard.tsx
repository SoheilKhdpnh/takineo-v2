"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { replaceTeacherAvailability } from "@/components/availability/teacher-availability-api";
import { TeacherOnboardingProfileSteps } from "@/components/onboarding/TeacherOnboardingProfileSteps";
import { TeacherOnboardingSessionSteps } from "@/components/onboarding/TeacherOnboardingSessionSteps";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";
import {
  readTeacherOnboardingDraft,
  TEACHER_ONBOARDING_STEPS,
  writeTeacherOnboardingDraft,
  type TeacherOnboardingDraft,
  type TeacherOnboardingStep,
} from "@/lib/onboarding/teacher-draft";
import {
  authPrimaryButtonClassName,
  authSecondaryButtonClassName,
} from "@/lib/ui/auth-styles";

interface TeacherOnboardingWizardProps {
  initialName: string;
}

export function TeacherOnboardingWizard({ initialName }: TeacherOnboardingWizardProps) {
  const router = useRouter();
  const t = useTranslations("TeacherOnboarding");
  const common = useTranslations("ProfileCommon");
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState(() => readTeacherOnboardingDraft(initialName));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openDescription, setOpenDescription] = useState<1 | 2 | 3 | 4>(1);

  const step = TEACHER_ONBOARDING_STEPS[stepIndex];
  const isLast = stepIndex === TEACHER_ONBOARDING_STEPS.length - 1;

  function updateDraft(patch: Partial<TeacherOnboardingDraft>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      writeTeacherOnboardingDraft(next);
      return next;
    });
  }

  const weekdayLabels = useMemo(
    () => ({
      SATURDAY: t("days.saturday"),
      SUNDAY: t("days.sunday"),
      MONDAY: t("days.monday"),
      TUESDAY: t("days.tuesday"),
      WEDNESDAY: t("days.wednesday"),
      THURSDAY: t("days.thursday"),
      FRIDAY: t("days.friday"),
    }),
    [t],
  );

  function validateStep(current: TeacherOnboardingStep) {
    if (current === "about") {
      if (draft.about.name.trim().length < 2) return t("errors.name");
      if (!draft.about.experienceYears) return t("errors.experience");
    }

    if (current === "photo" && !draft.photoDataUrl) {
      return t("errors.photo");
    }

    if (current === "certification" && !draft.noCertificate) {
      if (draft.certificates.some((item) => !item.name)) return t("errors.certificate");
    }

    if (current === "education" && !draft.noEducation) {
      if (draft.education.some((item) => !item.university || !item.degree)) {
        return t("errors.education");
      }
    }

    if (current === "description") {
      if (draft.description.intro.trim().length < 30) return t("errors.intro");
      if (draft.description.experience.trim().length < 30) return t("errors.experienceText");
      if (draft.description.motivate.trim().length < 30) return t("errors.motivate");
      if (draft.description.headline.trim().length < 10) return t("errors.headline");
    }

    if (current === "video") {
      if (!/^https?:\/\/(www\.)?aparat\.com\//i.test(draft.aparatUrl.trim())) {
        return t("errors.aparat");
      }
    }

    if (current === "availability") {
      if (!draft.availability.some((day) => day.enabled)) return t("errors.availability");
    }

    if (current === "pricing" && !draft.pricingAcknowledged) {
      return t("errors.pricing");
    }

    return null;
  }

  async function persistAndFinish() {
    const experienceYears = Number(draft.about.experienceYears);
    const bio = [
      draft.description.intro.trim(),
      draft.description.experience.trim(),
      draft.description.motivate.trim(),
    ].join("\n\n");

    const nameResult = await authClient.updateUser({
      name: draft.about.name.trim(),
    });

    if (nameResult.error) {
      throw new Error("name");
    }

    const profileResponse = await fetch("/api/profile/teacher", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        headline: draft.description.headline.trim(),
        bio,
        experienceYears,
        nativeLanguage: draft.about.nativeLanguage,
        teachingLanguage: "en",
        timezone: draft.about.timezone,
      }),
    });

    if (!profileResponse.ok) {
      throw new Error("profile");
    }

    await replaceTeacherAvailability(
      draft.availability
        .filter((day) => day.enabled)
        .map((day) => ({
          weekday: day.weekday,
          startMinute: day.startMinute,
          endMinute: day.endMinute,
          isActive: true,
        })),
    );
  }

  async function handleContinue() {
    const validationError = validateStep(step);
    setError(validationError);

    if (validationError) {
      return;
    }

    if (!isLast) {
      setStepIndex((current) => current + 1);
      return;
    }

    setIsSubmitting(true);

    try {
      await persistAndFinish();
      router.push("/teacher/dashboard");
      router.refresh();
    } catch {
      setError(t("errors.save"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const panelProps = {
    step,
    draft,
    updateDraft,
    t,
    common,
    openDescription,
    setOpenDescription,
    weekdayLabels,
    setError,
  };

  return (
    <div className="w-full max-w-xl">
      <ol className="mb-8 flex gap-2 overflow-x-auto pb-2 text-xs font-medium text-zinc-500">
        {TEACHER_ONBOARDING_STEPS.map((item, index) => (
          <li key={item} className="shrink-0">
            <span
              className={
                index === stepIndex
                  ? "rounded-full bg-[#c2410c] px-3 py-1 text-white"
                  : index < stepIndex
                    ? "rounded-full bg-[#edddd4] px-3 py-1 text-[#9a3412]"
                    : "rounded-full bg-white px-3 py-1"
              }
            >
              {index + 1}. {t(`steps.${item}`)}
            </span>
          </li>
        ))}
      </ol>

      <TeacherOnboardingProfileSteps {...panelProps} />
      <TeacherOnboardingSessionSteps {...panelProps} />

      {error ? (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          disabled={stepIndex === 0 || isSubmitting}
          onClick={() => {
            setError(null);
            setStepIndex((current) => Math.max(0, current - 1));
          }}
          className={`flex-1 ${authSecondaryButtonClassName}`}
        >
          {t("back")}
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            void handleContinue();
          }}
          className={`flex-1 ${authPrimaryButtonClassName}`}
        >
          {isSubmitting ? t("saving") : isLast ? t("finish") : t("saveAndContinue")}
        </button>
      </div>
    </div>
  );
}
