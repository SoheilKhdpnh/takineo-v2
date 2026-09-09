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
  "script-src 'self' 'unsafe-inline' https://src.litix.io",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://image.mux.com https://*.mux.com https://*.litix.io",
  "media-src 'self' blob: https://*.mux.com",
  "connect-src 'self' https://*.mux.com https://*.litix.io https://storage.googleapis.com",
  "frame-src 'self' https://player.mux.com",
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
