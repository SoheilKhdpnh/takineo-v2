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
    <div className="mx-auto w-full max-w-xl pb-8">
      <nav
        aria-label={t("stepsNavLabel")}
        className="sticky top-0 z-20 -mx-4 mb-6 border-b border-[#edddd4] bg-[#fffaf6]/95 px-4 py-3 backdrop-blur-sm sm:-mx-0 sm:mb-8 sm:rounded-2xl sm:border sm:px-3"
      >
        <ol className="flex gap-1 overflow-x-auto pb-1 text-[11px] font-medium text-zinc-500 sm:gap-2 sm:text-xs [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TEACHER_ONBOARDING_STEPS.map((item, index) => {
            const isCurrent = index === stepIndex;
            const isDone = index < stepIndex;

            return (
              <li key={item} className="shrink-0">
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  className={
                    isCurrent
                      ? "inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-2.5 py-1.5 text-white"
                      : isDone
                        ? "inline-flex items-center gap-1.5 rounded-full bg-[#edddd4] px-2.5 py-1.5 text-[#9a3412]"
                        : "inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 ring-1 ring-[#edddd4]"
                  }
                >
                  <span
                    className={
                      isCurrent
                        ? "grid size-4 place-items-center rounded-full bg-white text-[10px] font-semibold text-zinc-950"
                        : isDone
                          ? "grid size-4 place-items-center rounded-full bg-[#c2410c] text-[10px] font-semibold text-white"
                          : "grid size-4 place-items-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-600"
                    }
                  >
                    {isDone ? "✓" : index + 1}
                  </span>
                  <span className="whitespace-nowrap">{t(`steps.${item}`)}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-zinc-500 sm:hidden">
          {t("stepProgress", {
            current: stepIndex + 1,
            total: TEACHER_ONBOARDING_STEPS.length,
          })}
        </p>
      </nav>

      <TeacherOnboardingProfileSteps {...panelProps} />
      <TeacherOnboardingSessionSteps {...panelProps} />

      {error ? (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-[#edddd4] bg-[#fffaf6]/95 px-4 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="flex gap-3">
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
    </div>
  );
}
