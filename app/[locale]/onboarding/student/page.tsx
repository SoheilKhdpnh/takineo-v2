import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { StudentOnboardingForm } from "@/components/onboarding/StudentOnboardingForm";
import { requireAppLocale } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";
import { requireRolePage } from "@/lib/auth/page-guards";
import { getStudentProfileForUser } from "@/lib/services/student-profile.service";

export const dynamic = "force-dynamic";

interface StudentOnboardingPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function StudentOnboardingPage({
  params,
}: StudentOnboardingPageProps) {
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);
  const { session } = await requireRolePage("STUDENT", locale);
  const profile = await getStudentProfileForUser(session.user.id);

  if (profile.profileCompletedAt) {
    redirect({
      href: "/student/dashboard",
      locale,
    });
  }

  setRequestLocale(locale);

  const t = await getTranslations({
    locale,
    namespace: "StudentOnboarding",
  });

  return (
    <AuthSplitLayout
      brand={t("brand")}
      photoTitle={t("photoTitle")}
      photoSubtitle={t("photoSubtitle")}
      aside="quotes"
      quotes={[
        { text: t("quoteOne"), attribution: t("quoteOneBy") },
        { text: t("quoteTwo"), attribution: t("quoteTwoBy") },
        { text: t("quoteThree"), attribution: t("quoteThreeBy") },
      ]}
    >
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{t("description")}</p>
        <div className="mt-8">
          <StudentOnboardingForm
            initialName={session.user.name ?? ""}
            initialBio={profile.learningGoal ?? ""}
            initialLevel={profile.englishLevel}
          />
        </div>
      </div>
    </AuthSplitLayout>
  );
}
