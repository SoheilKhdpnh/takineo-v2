import type { Dispatch, SetStateAction } from "react";
import type { useTranslations } from "next-intl";

import type {
  TeacherOnboardingDraft,
  TeacherOnboardingStep,
} from "@/lib/onboarding/teacher-draft";

export type TeacherOnboardingPanelProps = {
  step: TeacherOnboardingStep;
  draft: TeacherOnboardingDraft;
  updateDraft: (patch: Partial<TeacherOnboardingDraft>) => void;
  t: ReturnType<typeof useTranslations>;
  common: ReturnType<typeof useTranslations>;
  openDescription: 1 | 2 | 3 | 4;
  setOpenDescription: Dispatch<SetStateAction<1 | 2 | 3 | 4>>;
  weekdayLabels: Record<string, string>;
  setError: (value: string | null) => void;
};
