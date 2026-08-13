import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import { requireAppLocale } from "@/i18n/locale";
import { requireAdminPageAccess } from "@/lib/auth/admin-page-guard";

interface AdminLayoutProps {
  children: ReactNode;
  params: Promise<{
    locale: string;
  }>;
}

export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { locale: requestedLocale } =
    await params;

  const locale = requireAppLocale(
    requestedLocale,
  );

  setRequestLocale(locale);

  const { session, admin } =
    await requireAdminPageAccess(locale);

  const t = await getTranslations({
    locale,
    namespace: "AdminShell",
  });

  return (
    <AdminShell
      administratorName={session.user.name}
      permission={admin.permission}
      copy={{
        skipToContent: t("skipToContent"),
        brand: t("brand"),
        workspace: t("workspace"),
        navigationLabel: t("navigationLabel"),
        overview: t("overview"),
        signedInAs: t("signedInAs"),
        permissionLabel: t("permissionLabel"),
        reviewerPermission: t("reviewerPermission"),
        superAdminPermission: t("superAdminPermission"),
      }}
    >
      {children}
    </AdminShell>
  );
}
