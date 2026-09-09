import "@fontsource-variable/manrope/wght.css";
import "@fontsource-variable/vazirmatn/wght.css";
import "@fontsource-variable/manrope";
import "@fontsource-variable/vazirmatn";
import "@/app/globals.css";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import type { ReactNode } from "react";

import { SiteChrome } from "@/components/layout/SiteChrome";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { requireAppLocale } from "@/i18n/locale";
import { isRtlLocale, routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth/session";
import { SITE_NAME, SITE_URL } from "@/lib/site";

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
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);
  const t = await getTranslations({
    locale,
    namespace: "Metadata",
  });

  const title = t("title");
  const description = t("description");
  const canonical = `${SITE_URL}/${locale}`;

  return {
    metadataBase: new URL(SITE_URL),
    applicationName: SITE_NAME,
    title: {
      default: title,
      template: `%s · ${SITE_NAME}`,
    },
    description,
    alternates: {
      canonical,
      languages: {
        fa: `${SITE_URL}/fa`,
        en: `${SITE_URL}/en`,
        "x-default": `${SITE_URL}/fa`,
      },
    },
    openGraph: {
      type: "website",
      locale: locale === "fa" ? "fa_IR" : "en_US",
      url: canonical,
      siteName: SITE_NAME,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    icons: {
      icon: "/icon.svg",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);

  setRequestLocale(locale);

  const [messages, session] = await Promise.all([
    getMessages(),
    getCurrentSession(),
  ]);

  return (
    <html
      lang={locale}
      dir={isRtlLocale(locale) ? "rtl" : "ltr"}
      data-locale={locale}
    >
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SiteChrome
            header={
              <SiteHeader
                locale={locale}
                isSignedIn={session !== null}
              />
            }
            footer={<SiteFooter locale={locale} />}
          >
            {children}
          </SiteChrome>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
