"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { persistTeacherOnboardingApplication } from "@/lib/onboarding/teacher-application-persist";
import { readTeacherOnboardingDraft } from "@/lib/onboarding/teacher-draft";

export function TeacherOnboardingPendingSubmit() {
  const router = useRouter();
  const t = useTranslations("TeacherOnboarding");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const draft = readTeacherOnboardingDraft("");

    if (!draft.aparatUrl.trim()) {
      router.replace("/onboarding/teacher");
      return;
    }

    void persistTeacherOnboardingApplication(draft)
      .then(() => {
        router.replace("/onboarding/teacher/pending");
        router.refresh();
      })
      .catch(() => {
        setError(t("errors.save"));
      });
  }, [router, t]);

  return (
    <div className="w-full max-w-md rounded-2xl border border-[#edddd4] bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-semibold tracking-[0.18em] text-[#c2410c] uppercase">
        {t("pendingEyebrow")}
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">
        {t("saving")}
      </h1>
      {error ? (
        <p role="alert" className="mt-4 text-sm leading-7 text-red-700">
          {error}
        </p>
      ) : (
        <p className="mt-4 text-sm leading-7 text-zinc-600">
          {t("pendingDescription")}
        </p>
      )}
    </div>
  );
}
