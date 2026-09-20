"use client";

import type { ReactNode } from "react";

import { usePathname } from "@/i18n/navigation";

export function SiteChrome({
  header,
  footer,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin =
    pathname === "/admin" ||
    pathname.startsWith("/admin/");
  const isLiveSessionJoin = /^\/sessions\/[^/]+\/join$/.test(
    pathname,
  );

  if (isAdmin || isLiveSessionJoin) {
    return children;
  }

  return (
    <div className="flex min-h-screen flex-col">
      {header}
      <div className="flex-1">{children}</div>
      {footer}
    </div>
  );
}
