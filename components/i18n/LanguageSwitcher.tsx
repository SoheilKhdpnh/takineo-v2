"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/ui/cn";

export function LanguageSwitcher({
  currentLocale,
  className,
}: {
  currentLocale: AppLocale;
  className?: string;
}) {
  const t = useTranslations("LanguageSwitcher");
  const pathname = usePathname();
  const targetLocale: AppLocale =
    currentLocale === "fa" ? "en" : "fa";

  return (
    <Link
      href={pathname}
      locale={targetLocale}
      aria-label={
        targetLocale === "fa"
          ? t("switchToPersian")
          : t("switchToEnglish")
      }
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink transition hover:bg-mint",
        className,
      )}
    >
      {targetLocale === "fa" ? "فارسی" : "English"}
    </Link>
  );
}
