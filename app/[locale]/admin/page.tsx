import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { requireAppLocale } from "@/i18n/locale";

interface AdminOverviewPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function AdminOverviewPage({
  params,
}: AdminOverviewPageProps) {
  const { locale: requestedLocale } =
    await params;

  const locale = requireAppLocale(
    requestedLocale,
  );

  setRequestLocale(locale);

  const t = await getTranslations({
    locale,
    namespace: "AdminDashboard",
  });

  return (
    <section aria-labelledby="admin-overview-title">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-zinc-500">
          {t("eyebrow")}
        </p>

        <h1
          id="admin-overview-title"
          className="mt-3 text-4xl font-semibold text-zinc-950 sm:text-5xl lg:text-[3.5rem]"
        >
          {t("title")}
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg sm:leading-8">
          {t("description")}
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.6fr)]">
        <article className="overflow-hidden rounded-[2rem] bg-zinc-950 p-7 text-white shadow-[0_24px_70px_rgba(24,24,27,0.14)] sm:p-9">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-zinc-400">
                {t("reviewHeading")}
              </p>

              <h2 className="mt-3 max-w-xl text-2xl font-semibold text-white sm:text-3xl">
                {t("reviewTitle")}
              </h2>
            </div>

            <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-zinc-200">
              {t("nextMilestone")}
            </span>
          </div>

          <p className="mt-6 max-w-2xl leading-8 text-zinc-300">
            {t("reviewDescription")}
          </p>

          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="text-sm leading-7 text-zinc-400">
              {t("reviewBoundary")}
            </p>
          </div>
        </article>

        <aside className="rounded-[2rem] border border-zinc-200 bg-white p-7 shadow-sm sm:p-8">
          <div
            aria-hidden="true"
            className="grid size-11 place-items-center rounded-2xl bg-zinc-100"
          >
            <span className="size-2.5 rounded-full bg-zinc-950" />
          </div>

          <h2 className="mt-6 text-xl font-semibold text-zinc-950">
            {t("accessHeading")}
          </h2>

          <p className="mt-3 text-sm leading-7 text-zinc-600">
            {t("accessDescription")}
          </p>

          <p className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold leading-6 text-zinc-600">
            {t("accessNote")}
          </p>
        </aside>
      </div>
    </section>
  );
}
