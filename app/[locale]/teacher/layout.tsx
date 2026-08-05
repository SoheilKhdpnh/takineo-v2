import type { ReactNode } from "react";

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
  const { locale: requestedLocale } =
    await params;

  const locale = requireAppLocale(
    requestedLocale,
  );

  await requireRolePage("TEACHER", locale);

  return children;
}