"use client";

import { Link, usePathname } from "@/i18n/navigation";

interface AdminNavigationProps {
  label: string;
  overviewLabel: string;
  teacherApplicationsLabel: string;
}

const baseLinkClass =
  "flex min-h-11 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

export function AdminNavigation({
  label,
  overviewLabel,
  teacherApplicationsLabel,
}: AdminNavigationProps) {
  const pathname = usePathname();
  const teacherApplicationsActive = pathname.startsWith(
    "/admin/teacher-applications",
  );
  const overviewActive = pathname === "/admin";

  return (
    <nav aria-label={label} className="mt-7 lg:mt-12">
      <div className="space-y-2">
        <Link
          href="/admin"
          aria-current={overviewActive ? "page" : undefined}
          className={`${baseLinkClass} ${
            overviewActive
              ? "border-white/10 bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              : "border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
          }`}
        >
          <span>{overviewLabel}</span>
          {overviewActive ? (
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-white"
            />
          ) : null}
        </Link>

        <Link
          href="/admin/teacher-applications"
          aria-current={teacherApplicationsActive ? "page" : undefined}
          className={`${baseLinkClass} ${
            teacherApplicationsActive
              ? "border-white/10 bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              : "border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
          }`}
        >
          <span>{teacherApplicationsLabel}</span>
          {teacherApplicationsActive ? (
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-white"
            />
          ) : null}
        </Link>
      </div>
    </nav>
  );
}
