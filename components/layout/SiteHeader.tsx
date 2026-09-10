import { getTranslations } from "next-intl/server";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { buttonClassName } from "@/components/ui/Button";
import { TalkinuWordmark } from "@/components/ui/TalkinuMark";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/ui/cn";

export async function SiteHeader({
  locale,
  isSignedIn,
}: {
  locale: AppLocale;
  isSignedIn: boolean;
}) {
  const t = await getTranslations({
    locale,
    namespace: "Site",
  });

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="rounded-md"
        >
          <TalkinuWordmark brand={t("brand")} />
        </Link>

        <nav
          aria-label={t("navigationLabel")}
          className="flex items-center gap-2 sm:gap-3"
        >
          <Link
            href="/teachers"
            className="hidden min-h-10 items-center rounded-md px-3 text-sm font-semibold text-ink hover:bg-mint sm:inline-flex"
          >
            {t("teachers")}
          </Link>
          <Link
            href="/blog"
            className="hidden min-h-10 items-center rounded-md px-3 text-sm font-semibold text-ink hover:bg-mint sm:inline-flex"
          >
            {t("blog")}
          </Link>

          <LanguageSwitcher currentLocale={locale} />

          {isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className={cn(
                  buttonClassName({
                    variant: "secondary",
                    size: "sm",
                  }),
                  "hidden sm:inline-flex",
                )}
              >
                {t("workspace")}
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden min-h-10 items-center px-2 text-sm font-semibold text-ink sm:inline-flex"
              >
                {t("signIn")}
              </Link>
              <Link
                href="/sign-up"
                className={buttonClassName({
                  size: "sm",
                })}
              >
                {t("getStarted")}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
