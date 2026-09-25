import type { ReactNode } from "react";

import { StudentWorkspaceShell } from "@/components/student/StudentWorkspaceShell";
import { requireAppLocale } from "@/i18n/locale";
import { requireRolePage } from "@/lib/auth/page-guards";

interface StudentLayoutProps {
  children: ReactNode;
  params: Promise<{
    locale: string;
  }>;
}

export default async function StudentLayout({
  children,
  params,
}: StudentLayoutProps) {
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);
  const { session } = await requireRolePage("STUDENT", locale);

  return (
    <StudentWorkspaceShell
      locale={locale}
      userName={session.user.name ?? ""}
      userImage={session.user.image ?? null}
    >
      {children}
    </StudentWorkspaceShell>
  );
}
