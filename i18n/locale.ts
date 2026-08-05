import "server-only";

import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import {
  routing,
  type AppLocale,
} from "@/i18n/routing";

export function requireAppLocale(
  locale: string,
): AppLocale {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return locale;
}