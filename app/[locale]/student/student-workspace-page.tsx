import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { UpcomingSessionsPanel } from "@/components/sessions/UpcomingSessionsPanel";
import { TeacherDiscoveryPanel } from "@/components/teachers/TeacherDiscoveryPanel";
import { StudentProfileForm } from "@/components/profiles/StudentProfileForm";
import { StudentProfileOverview } from "@/components/student/StudentProfileOverview";
import { requireAppLocale } from "@/i18n/locale";
import { requireRolePage } from "@/lib/auth/page-guards";
import type { ProfileTimezone } from "@/lib/domain/profile";
import { getStudentProfileForUser } from "@/lib/services/student-profile.service";

export interface StudentWorkspacePageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function StudentWorkspacePage({
  params,
}: StudentWorkspacePageProps) {
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);

  setRequestLocale(locale);

  const { session } = await requireRolePage("STUDENT", locale);
  const profile = await getStudentProfileForUser(session.user.id);
  const t = await getTranslations({
    locale,
    namespace: "StudentProfile",
  });

  const timezone = profile.timezone as ProfileTimezone;
  const profileCompleted = profile.profileCompletedAt !== null;

  if (!profileCompleted) {
    return (
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <section className="mx-auto w-full max-w-2xl rounded-2xl border border-[#edddd4] bg-white p-6 sm:p-10">
          <p className="text-sm font-semibold tracking-[0.14em] text-[#c2410c] uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm leading-7 text-zinc-600">
            {t("description")}
          </p>
          <div className="mt-8">
            <StudentProfileForm
              initialValue={{
                englishLevel: profile.englishLevel,
                learningGoal: profile.learningGoal ?? "",
                nativeLanguage: profile.nativeLanguage,
                timezone,
              }}
            />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <StudentProfileOverview
        userName={session.user.name ?? ""}
        userImage={session.user.image ?? null}
        profile={{
          englishLevel: profile.englishLevel,
          learningGoal: profile.learningGoal,
          nativeLanguage: profile.nativeLanguage,
          timezone,
          createdAt: profile.createdAt,
          profileCompletedAt: profile.profileCompletedAt,
        }}
      >
        <section
          id="student-sessions"
          className="mt-6 scroll-mt-24"
        >
          <UpcomingSessionsPanel viewerRole="STUDENT" />
        </section>

        <section
          id="messages"
          className="mt-6 scroll-mt-24"
        >
          <div className="rounded-2xl border border-[#edddd4] bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-zinc-950">
              {t("discoverTitle")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              {t("discoverBody")}
            </p>
            <div className="mt-5">
              <TeacherDiscoveryPanel />
            </div>
          </div>
        </section>

        <section
          id="settings"
          className="mt-6 mb-8 scroll-mt-24"
        >
          <div className="rounded-2xl border border-[#edddd4] bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-zinc-950">
              {t("settingsTitle")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              {t("settingsBody")}
            </p>
            <div className="mt-5 max-w-xl">
              <StudentProfileForm
                initialValue={{
                  englishLevel: profile.englishLevel,
                  learningGoal: profile.learningGoal ?? "",
                  nativeLanguage: profile.nativeLanguage,
                  timezone,
                }}
              />
            </div>
          </div>
        </section>
      </StudentProfileOverview>
    </main>
  );
}
