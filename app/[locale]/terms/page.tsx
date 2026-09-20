import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireAppLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

const TERM_SECTIONS = [
  "agreement",
  "service",
  "accounts",
  "students",
  "teachers",
  "sessions",
  "payments",
  "conduct",
  "intellectualProperty",
  "prohibitedUse",
  "termination",
  "disclaimers",
  "liability",
  "changes",
  "contact",
] as const;

interface TermsPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function TermsPage({ params }: TermsPageProps) {
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);

  setRequestLocale(locale);

  const t = await getTranslations({
    locale,
    namespace: "Terms",
  });

  return (
    <main className="min-h-screen bg-[#fffaf6] px-4 py-16">
      <article className="mx-auto w-full max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.18em] text-[#c2410c] uppercase">
          {t("brand")}
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm text-zinc-500">{t("updated")}</p>
        <p className="mt-6 text-base leading-7 text-zinc-700">{t("intro")}</p>

        <div className="mt-10 space-y-8">
          {TERM_SECTIONS.map((section) => (
            <section key={section}>
              <h2 className="text-xl font-semibold text-zinc-950">
                {t(`sections.${section}.title`)}
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-zinc-700">
                {t(`sections.${section}.body`)}
              </p>
            </section>
          ))}
        </div>

        <p className="mt-12 text-sm text-zinc-600">
          <Link
            href="/sign-up"
            className="font-medium text-[#9a3412] underline-offset-4 hover:underline"
          >
            {t("backToSignUp")}
          </Link>
        </p>
      </article>
    </main>
  );
}
