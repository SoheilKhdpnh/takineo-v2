import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { UpcomingSessionsPanel } from "@/components/sessions/UpcomingSessionsPanel";
import { TeacherDiscoveryPanel } from "@/components/teachers/TeacherDiscoveryPanel";
import { buttonClassName } from "@/components/ui/Button";
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
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);

  setRequestLocale(locale);

  const { access } = await requireRolePage("STUDENT", locale);

  if (!access.studentProfile?.profileCompletedAt) {
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
    <main className="px-4 py-10 sm:px-6 sm:py-12">
      <section className="mx-auto max-w-6xl">
        <header className="rounded-lg border border-line bg-surface p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">
                {t("eyebrow")}
              </p>
              <h1 className="mt-2 text-3xl tracking-tight text-ink">
                {t("title")}
              </h1>
              <p className="mt-3 max-w-xl leading-7 text-ink-muted">
                {t("description")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/teachers"
                  className={buttonClassName()}
                >
                  {t("findTeacher")}
                </Link>
                <Link
                  href="/student/profile"
                  className={buttonClassName({ variant: "secondary" })}
                >
                  {t("editProfile")}
                </Link>
              </div>
            </div>
            <SignOutButton />
          </div>
        </header>

        <div className="mt-6">
          <UpcomingSessionsPanel viewerRole="STUDENT" />
        </div>

        <div className="mt-6">
          <TeacherDiscoveryPanel />
        </div>
      </section>
    </main>
  );
}
