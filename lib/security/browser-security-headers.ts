export type BrowserSecurityHeader = {
  key: string;
  value: string;
};

const BASE_BROWSER_SECURITY_HEADERS: BrowserSecurityHeader[] = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const PRODUCTION_CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://www.aparat.com https://*.aparat.com",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "frame-src 'self' https://www.aparat.com",
  "worker-src 'self' blob:",
].join("; ");

export function getBrowserSecurityHeaders(
  isProduction: boolean,
): BrowserSecurityHeader[] {
  const headers = BASE_BROWSER_SECURITY_HEADERS.map((header) => ({ ...header }));

  if (isProduction) {
    headers.push({
      key: "Content-Security-Policy-Report-Only",
      value: PRODUCTION_CSP_REPORT_ONLY,
    });
  }

  return headers;
}
