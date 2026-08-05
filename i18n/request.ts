import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "@/i18n/routing";

export default getRequestConfig(
  async ({ requestLocale }) => {
    const requestedLocale = await requestLocale;

    /*
     * Before the route migration, requestLocale can be
     * undefined for the current unprefixed routes.
     *
     * Persian is used as the safe default.
     */
    const locale = hasLocale(
      routing.locales,
      requestedLocale,
    )
      ? requestedLocale
      : routing.defaultLocale;

    return {
      locale,

      timeZone: "Asia/Tehran",

      messages: (
        await import(`../messages/${locale}.json`)
      ).default,
    };
  },
);