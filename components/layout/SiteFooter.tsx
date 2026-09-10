import { getTranslations } from "next-intl/server";

import { TalkinuWordmark } from "@/components/ui/TalkinuMark";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export async function SiteFooter({
  locale,
}: {
  locale: AppLocale;
}) {
  const t = await getTranslations({
    locale,
    namespace: "Site",
  });

  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <TalkinuWordmark
            brand={t("brand")}
            markClassName="size-8"
          />
          <p className="mt-3 max-w-sm text-sm leading-6 text-ink-muted">
            {t("footerBlurb")}
          </p>
        </div>

        <nav
          aria-label={t("footerNavigationLabel")}
          className="flex flex-col gap-2 text-sm font-medium text-ink"
        >
          <Link href="/teachers" className="hover:text-primary">
            {t("teachers")}
          </Link>
          <Link href="/sign-up" className="hover:text-primary">
            {t("getStarted")}
          </Link>
          <Link href="/sign-in" className="hover:text-primary">
            {t("signIn")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
