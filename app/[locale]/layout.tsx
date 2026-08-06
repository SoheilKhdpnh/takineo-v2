import "@fontsource-variable/manrope/wght.css";
import "@fontsource-variable/vazirmatn/wght.css";
import "@/app/globals.css";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import type { ReactNode } from "react";
import "@fontsource-variable/manrope";
import "@fontsource-variable/vazirmatn";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { requireAppLocale } from "@/i18n/locale";
import {
  isRtlLocale,
  routing,
} from "@/i18n/routing";

import "../globals.css";


interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{
    locale: string;
  }>;
}

interface GenerateMetadataProps {
  params: Promise<{
    locale: string;
  }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({
    locale,
  }));
}

export async function generateMetadata({
  params,
}: GenerateMetadataProps): Promise<Metadata> {
  const { locale: requestedLocale } =
    await params;

  const locale = requireAppLocale(
    requestedLocale,
  );

  const t = await getTranslations({
    locale,
    namespace: "Metadata",
  });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale: requestedLocale } =
    await params;

  const locale = requireAppLocale(
    requestedLocale,
  );

  setRequestLocale(locale);

  const messages = await getMessages();

 return (
    <html
      lang={locale}
      dir={isRtlLocale(locale) ? "rtl" : "ltr"}
      data-locale={locale}
    >
      <body
        className="antialiased"
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LanguageSwitcher />

          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )};