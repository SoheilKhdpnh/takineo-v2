import type { ReactNode } from "react";

import { TeacherWorkspaceShell } from "@/components/teacher/TeacherWorkspaceShell";
import { requireAppLocale } from "@/i18n/locale";
import { requireRolePage } from "@/lib/auth/page-guards";

interface TeacherLayoutProps {
  children: ReactNode;
  params: Promise<{
    locale: string;
  }>;
}

export default async function TeacherLayout({
  children,
  params,
}: TeacherLayoutProps) {
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);
  const { session } = await requireRolePage("TEACHER", locale);

  return (
    <TeacherWorkspaceShell
      locale={locale}
      userName={session.user.name ?? ""}
      userImage={session.user.image ?? null}
    >
      {children}
    </TeacherWorkspaceShell>
  );
}
