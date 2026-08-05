import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { requireAppLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

interface HomePageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function HomePage({
  params,
}: HomePageProps) {
  const { locale: requestedLocale } =
    await params;

  const locale = requireAppLocale(
    requestedLocale,
  );

  setRequestLocale(locale);

  const t = await getTranslations({
    locale,
    namespace: "Home",
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <section className="w-full max-w-3xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="text-sm font-medium text-zinc-500">
          {t("eyebrow")}
        </p>

        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
          {t("title")}
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600">
          {t("description")}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="rounded-lg bg-zinc-950 px-5 py-3 text-center font-medium text-white transition hover:bg-zinc-800"
          >
            {t("createAccount")}
          </Link>

          <Link
            href="/sign-in"
            className="rounded-lg border border-zinc-300 px-5 py-3 text-center font-medium text-zinc-950 transition hover:bg-zinc-100"
          >
            {t("signIn")}
          </Link>
        </div>
      </section>
    </main>
  );
}