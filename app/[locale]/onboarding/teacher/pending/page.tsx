import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { TeacherOnboardingPendingSubmit } from "@/components/onboarding/TeacherOnboardingPendingSubmit";
import { requireAppLocale } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";
import { requireRolePage } from "@/lib/auth/page-guards";

export const dynamic = "force-dynamic";

interface TeacherPendingPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function TeacherPendingPage({
  params,
}: TeacherPendingPageProps) {
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);
  const { access } = await requireRolePage("TEACHER", locale);

  if (access.teacherProfile?.applicationStatus === "APPROVED") {
    redirect({
      href: "/teacher/dashboard",
      locale,
    });
  }

  if (
    access.teacherProfile?.applicationStatus === "DRAFT" &&
    !access.teacherProfile.profileCompletedAt
  ) {
    redirect({
      href: "/onboarding/teacher",
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
      {access.teacherProfile?.applicationStatus === "DRAFT" ? (
        <TeacherOnboardingPendingSubmit />
      ) : (
        <div className="w-full max-w-md rounded-2xl border border-[#edddd4] bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold tracking-[0.18em] text-[#c2410c] uppercase">
            {t("pendingEyebrow")}
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">
            {t("pendingTitle")}
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-600">
            {t("pendingDescription")}
          </p>
          <p className="mt-4 text-sm leading-7 text-zinc-500">
            {t("pendingHint")}
          </p>
        </div>
      )}
    </AuthSplitLayout>
  );
}
