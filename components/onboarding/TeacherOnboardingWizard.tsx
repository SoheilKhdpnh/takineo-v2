"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { TeacherOnboardingProfileSteps } from "@/components/onboarding/TeacherOnboardingProfileSteps";
import { TeacherOnboardingSessionSteps } from "@/components/onboarding/TeacherOnboardingSessionSteps";
import { useRouter } from "@/i18n/navigation";
import { persistTeacherOnboardingApplication } from "@/lib/onboarding/teacher-application-persist";
import {
  readTeacherOnboardingDraft,
  TEACHER_ONBOARDING_STEPS,
  validateTeacherOnboardingStep,
  writeTeacherOnboardingDraft,
  type TeacherOnboardingDraft,
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

  async function persistAndFinish() {
    await persistTeacherOnboardingApplication(draft);
  }

  async function handleContinue() {
    const errorKey = validateTeacherOnboardingStep(draft, step);
    setError(errorKey ? t(`errors.${errorKey}`) : null);

    if (errorKey) {
      return;
    }

    if (!isLast) {
      setStepIndex((current) => current + 1);
      return;
    }

    setIsSubmitting(true);

    try {
      await persistAndFinish();
      router.push("/onboarding/teacher/pending");
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
