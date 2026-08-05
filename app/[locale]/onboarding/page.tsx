import { getTranslations } from "next-intl/server";

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

export default async function OnboardingPage({
  params,
}: OnboardingPageProps) {
  const { locale: requestedLocale } =
    await params;

  const locale = requireAppLocale(
    requestedLocale,
  );

  const { access } =
    await requireAuthenticatedPage(locale);

  if (access.role) {
    redirect({
      href: getRoleHome(access.role),
      locale,
    });
    return;
  }

  if (access.onboardingCompletedAt) {
    throw new Error(
      "Onboarding is completed but no role exists.",
    );
  }

  if (
    access.studentProfile ||
    access.teacherProfile
  ) {
    throw new Error(
      "A profile exists without an assigned role.",
    );
  }

  const t = await getTranslations({
    locale,
    namespace: "Onboarding",
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <section className="w-full max-w-3xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="text-sm font-medium text-zinc-500">
          {t("eyebrow")}
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          {t("title")}
        </h1>

        <p className="mt-3 max-w-2xl leading-7 text-zinc-600">
          {t("description")}
        </p>

        <div className="mt-8">
          <RoleSelectionForm />
        </div>
      </section>
    </main>
  );
}