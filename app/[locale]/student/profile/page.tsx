import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { StudentProfileForm } from "@/components/profiles/StudentProfileForm";
import { requireAppLocale } from "@/i18n/locale";
import { requireRolePage } from "@/lib/auth/page-guards";
import { getStudentProfileForUser } from "@/lib/services/student-profile.service";

interface StudentProfilePageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function StudentProfilePage({
  params,
}: StudentProfilePageProps) {
  const { locale: requestedLocale } =
    await params;

  const locale = requireAppLocale(
    requestedLocale,
  );

  setRequestLocale(locale);

  const { session } =
    await requireRolePage(
      "STUDENT",
      locale,
    );

  const profile =
    await getStudentProfileForUser(
      session.user.id,
    );

  const t = await getTranslations({
    locale,
    namespace: "StudentProfile",
  });

  return (
    <main className="px-4 py-12">
      <section className="mx-auto w-full max-w-2xl rounded-lg border border-line bg-surface p-8 sm:p-12">
        <p className="text-sm font-medium text-primary">
          {t("eyebrow")}
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
          {t("title")}
        </h1>

        <p className="mt-3 leading-7 text-ink-muted">
          {t("description")}
        </p>

        <div className="mt-8">
          <StudentProfileForm
            initialValue={{
              englishLevel:
                profile.englishLevel,
              learningGoal:
                profile.learningGoal ?? "",
              nativeLanguage:
                profile.nativeLanguage,
              timezone: profile.timezone,
            }}
          />
        </div>
      </section>
    </main>
  );
}