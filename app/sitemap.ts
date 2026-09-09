import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";

const publicPaths = ["", "/teachers", "/sign-in", "/sign-up"];

export default function sitemap(): MetadataRoute.Sitemap {
  return routing.locales.flatMap((locale) =>
    publicPaths.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
    })),
  );
}
