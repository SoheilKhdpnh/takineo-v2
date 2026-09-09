import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { TeacherDiscoveryPanel } from "@/components/teachers/TeacherDiscoveryPanel";
import { requireAppLocale } from "@/i18n/locale";

export const dynamic = "force-dynamic";

interface TeachersPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function TeachersPage({
  params,
}: TeachersPageProps) {
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);

  setRequestLocale(locale);

  const t = await getTranslations({
    locale,
    namespace: "TeacherDiscovery",
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm font-semibold text-primary">{t("pageEyebrow")}</p>
      <h1 className="mt-2 text-3xl text-ink sm:text-4xl">{t("pageTitle")}</h1>
      <p className="mt-3 max-w-2xl text-ink-muted">{t("pageDescription")}</p>
      <div className="mt-8">
        <TeacherDiscoveryPanel showHeader={false} />
      </div>
    </main>
  );
}
