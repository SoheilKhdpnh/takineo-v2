import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fa", "en"],

  defaultLocale: "fa",

  // Both languages will have explicit URLs:
  // /fa/... and /en/...
  localePrefix: "always",

  // Takineo launches Persian-first.
  // Visiting an unprefixed route will use the default locale
  // instead of changing based on browser language.
  localeDetection: false,
});

export type AppLocale =
  (typeof routing.locales)[number];

export function isRtlLocale(
  locale: string,
): boolean {
  return locale === "fa";
}
