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
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);

  setRequestLocale(locale);

  const { session } = await requireRolePage("STUDENT", locale);

  const profile = await getStudentProfileForUser(session.user.id);

  const t = await getTranslations({
    locale,
    namespace: "ProfileCommon",
  });

  return (
    <main>
      <StudentProfileForm
        displayName={session.user.name?.trim() || t("displayNameFallback")}
        image={session.user.image ?? null}
        initialValue={{
          englishLevel: profile.englishLevel,
          learningGoal: profile.learningGoal ?? "",
          nativeLanguage: profile.nativeLanguage,
          timezone: profile.timezone,
        }}
      />
    </main>
  );
}
