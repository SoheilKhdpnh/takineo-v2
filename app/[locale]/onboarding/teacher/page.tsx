import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { TeacherOnboardingWizard } from "@/components/onboarding/TeacherOnboardingWizard";
import { requireAppLocale } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";
import { requireRolePage } from "@/lib/auth/page-guards";

export const dynamic = "force-dynamic";

interface TeacherOnboardingPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function TeacherOnboardingPage({
  params,
}: TeacherOnboardingPageProps) {
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);
  const { session, access } = await requireRolePage("TEACHER", locale);

  if (access.teacherProfile?.applicationStatus !== "DRAFT") {
    redirect({
      href: "/teacher/dashboard",
      locale,
    });
  }

  setRequestLocale(locale);

  const t = await getTranslations({
    locale,
    namespace: "TeacherOnboarding",
  });

  return (
    <AuthSplitLayout
      brand={t("brand")}
      photoTitle={t("photoAsideTitle")}
      photoSubtitle={t("photoAsideSubtitle")}
    >
      <TeacherOnboardingWizard initialName={session.user.name ?? ""} />
    </AuthSplitLayout>
  );
}
