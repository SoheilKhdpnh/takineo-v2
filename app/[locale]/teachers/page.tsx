import { setRequestLocale } from "next-intl/server";

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

  return (
    <main className="w-full">
      <TeacherDiscoveryPanel showHeader />
    </main>
  );
}
