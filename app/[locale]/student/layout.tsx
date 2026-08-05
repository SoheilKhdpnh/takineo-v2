import type { ReactNode } from "react";

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
  const { locale: requestedLocale } =
    await params;

  const locale = requireAppLocale(
    requestedLocale,
  );

  await requireRolePage("STUDENT", locale);

  return children;
}