"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/ui/cn";

export function TeachersNavLink() {
  const t = useTranslations("Site");
  const pathname = usePathname();
  const active =
    pathname === "/teachers" || pathname.startsWith("/teachers/");

  return (
    <Link
      href="/teachers"
      aria-current={active ? "page" : undefined}
      className={cn(
        "hidden min-h-10 items-center rounded-md px-3 text-sm font-semibold sm:inline-flex",
        active
          ? "text-[#c2410c] underline decoration-[#c2410c] decoration-2 underline-offset-[0.85rem]"
          : "text-ink hover:bg-[#fff4ed]",
      )}
    >
      {t("teachers")}
    </Link>
  );
}
