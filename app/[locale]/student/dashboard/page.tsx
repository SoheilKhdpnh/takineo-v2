import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { requireAppLocale } from "@/i18n/locale";
import {
  Link,
  redirect,
} from "@/i18n/navigation";
import { requireRolePage } from "@/lib/auth/page-guards";

interface StudentDashboardPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function StudentDashboardPage({
  params,
}: StudentDashboardPageProps) {
  const { locale: requestedLocale } =
    await params;

  const locale = requireAppLocale(
    requestedLocale,
  );

  setRequestLocale(locale);

  const { access } =
    await requireRolePage(
      "STUDENT",
      locale,
    );

  if (
    !access.studentProfile
      ?.profileCompletedAt
  ) {
    redirect({
      href: "/student/profile",
      locale,
    });
  }

  const t = await getTranslations({
    locale,
    namespace: "StudentDashboard",
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-12">
      <section className="mx-auto max-w-4xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">
              {t("eyebrow")}
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
              {t("title")}
            </h1>

            <p className="mt-3 max-w-xl leading-7 text-zinc-600">
              {t("description")}
            </p>

            <Link
              href="/student/profile"
              className="mt-6 inline-flex rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
            >
              {t("editProfile")}
            </Link>
          </div>

          <SignOutButton />
        </div>
      </section>
    </main>
  );
}