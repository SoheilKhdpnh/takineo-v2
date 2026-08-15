import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { getBrowserSecurityHeaders } from "./lib/security/browser-security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: getBrowserSecurityHeaders(
          process.env.NODE_ENV === "production",
        ),
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin(
  "./i18n/request.ts",
);

export default withNextIntl(nextConfig);