import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { requireAppLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

interface ForgotPasswordPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function ForgotPasswordPage({
  params,
}: ForgotPasswordPageProps) {
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
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          {t("forgotPasswordTitle")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          {t("forgotPasswordDescription")}
        </p>
        <p className="mt-6 rounded-2xl border border-[#edddd4] bg-white px-4 py-3 text-sm leading-6 text-zinc-700">
          {t("forgotPasswordSoon")}
        </p>
        <p className="mt-6 text-sm text-zinc-600">
          <Link
            href="/sign-in"
            className="font-medium text-[#9a3412] underline-offset-4 hover:underline"
          >
            {t("backToSignIn")}
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
