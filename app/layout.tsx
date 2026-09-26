import type { ReactNode } from "react";

/**
 * Next.js requires a root layout. Locale-specific `<html>` / `<body>`
 * live in `app/[locale]/layout.tsx` (next-intl).
 */
export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
