"use client";

import {
  useLocale,
  useTranslations,
} from "next-intl";

import {
  Link,
  usePathname,
} from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations(
    "LanguageSwitcher",
  );

  const pathname = usePathname();
  const currentLocale =
    useLocale() as AppLocale;

  const targetLocale: AppLocale =
    currentLocale === "fa" ? "en" : "fa";

  return (
    <div className="fixed end-4 top-4 z-50">
      <Link
        href={pathname}
        locale={targetLocale}
        aria-label={
          targetLocale === "fa"
            ? t("switchToPersian")
            : t("switchToEnglish")
        }
        className="inline-flex min-h-10 items-center justify-center rounded-full border border-zinc-200 bg-white/90 px-4 text-sm font-medium text-zinc-800 shadow-sm backdrop-blur transition hover:bg-zinc-100"
      >
        {targetLocale === "fa"
          ? "فارسی"
          : "English"}
      </Link>
    </div>
  );
}