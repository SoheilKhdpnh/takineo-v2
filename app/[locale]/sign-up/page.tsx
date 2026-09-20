import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { requireAppLocale } from "@/i18n/locale";

export const dynamic = "force-dynamic";

interface SignUpPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function SignUpPage({ params }: SignUpPageProps) {
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
      <SignUpForm />
    </AuthSplitLayout>
  );
}
