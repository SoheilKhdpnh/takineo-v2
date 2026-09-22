import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { RoleSelectionForm } from "@/components/onboarding/RoleSelectionForm";
import { requireAuthenticatedPage } from "@/lib/auth/page-guards";
import { getRoleHome } from "@/lib/domain/user-role";
import { requireAppLocale } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

interface OnboardingPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);
  const { access } = await requireAuthenticatedPage(locale);

  if (access.role === "STUDENT" && !access.studentProfile?.profileCompletedAt) {
    redirect({
      href: "/onboarding/student",
      locale,
    });
  }

  if (access.role === "TEACHER" && access.teacherProfile?.applicationStatus === "DRAFT") {
    redirect({
      href: "/onboarding/teacher",
      locale,
    });
  }

  if (access.role) {
    redirect({
      href: getRoleHome(access.role),
      locale,
    });
  }

  if (access.onboardingCompletedAt) {
    throw new Error("Onboarding is completed but no role exists.");
  }

  if (access.studentProfile || access.teacherProfile) {
    throw new Error("A profile exists without an assigned role.");
  }

  setRequestLocale(locale);

  const t = await getTranslations({
    locale,
    namespace: "Onboarding",
  });

  return (
    <AuthSplitLayout
      brand={t("brand")}
      photoTitle={t("photoTitle")}
      photoSubtitle={t("photoSubtitle")}
    >
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{t("description")}</p>
        <div className="mt-8">
          <RoleSelectionForm />
        </div>
      </div>
    </AuthSplitLayout>
  );
}
