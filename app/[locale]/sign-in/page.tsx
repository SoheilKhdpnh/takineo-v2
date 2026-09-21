import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { SignInForm } from "@/components/auth/SignInForm";
import { requireAppLocale } from "@/i18n/locale";

export const dynamic = "force-dynamic";

interface SignInPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function SignInPage({ params }: SignInPageProps) {
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);

  setRequestLocale(locale);

  const t = await getTranslations({
    locale,
    namespace: "Auth",
  });

  return (
    <AuthSplitLayout
      brand={t("brand")}
      photoTitle={t("photoTitle")}
      photoSubtitle={t("photoSubtitle")}
    >
      <SignInForm />
    </AuthSplitLayout>
  );
}
