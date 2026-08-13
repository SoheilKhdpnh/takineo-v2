import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { Link } from "@/i18n/navigation";
import type { AdminPermissionValue } from "@/lib/auth/admin-access";

type AdminShellCopy = {
  skipToContent: string;
  brand: string;
  workspace: string;
  navigationLabel: string;
  overview: string;
  signedInAs: string;
  permissionLabel: string;
  reviewerPermission: string;
  superAdminPermission: string;
};

interface AdminShellProps {
  children: ReactNode;
  administratorName: string;
  permission: AdminPermissionValue;
  copy: AdminShellCopy;
}

const permissionLabelKey = {
  REVIEWER: "reviewerPermission",
  SUPER_ADMIN: "superAdminPermission",
} as const satisfies Record<
  AdminPermissionValue,
  keyof Pick<
    AdminShellCopy,
    "reviewerPermission" | "superAdminPermission"
  >
>;

export function AdminShell({
  children,
  administratorName,
  permission,
  copy,
}: AdminShellProps) {
  const permissionText =
    copy[permissionLabelKey[permission]];

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <a
        href="#admin-main"
        className="sr-only fixed start-4 top-4 z-[60] rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg focus:not-sr-only focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
      >
        {copy.skipToContent}
      </a>

      <div className="mx-auto min-h-screen max-w-[1600px] lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-zinc-950 text-white lg:min-h-screen lg:border-b-0 lg:border-e lg:border-white/10">
          <div className="flex h-full flex-col px-5 py-5 sm:px-6 lg:sticky lg:top-0 lg:min-h-screen lg:px-5 lg:py-7">
            <div className="pe-28 lg:pe-0">
              <Link
                href="/admin"
                className="group inline-flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-950"
              >
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-[0.9rem] border border-white/15 bg-white text-base font-extrabold tracking-[-0.06em] text-zinc-950 shadow-[0_10px_30px_rgba(255,255,255,0.08)] transition-transform group-hover:-translate-y-0.5"
                >
                  T
                </span>

                <span className="min-w-0">
                  <span className="block text-base font-semibold tracking-[-0.02em] text-white">
                    {copy.brand}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-zinc-400">
                    {copy.workspace}
                  </span>
                </span>
              </Link>
            </div>

            <nav
              aria-label={copy.navigationLabel}
              className="mt-7 lg:mt-12"
            >
              <Link
                href="/admin"
                aria-current="page"
                className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:bg-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <span>{copy.overview}</span>
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full bg-white"
                />
              </Link>
            </nav>

            <div className="mt-6 border-t border-white/10 pt-5 lg:mt-auto">
              <p className="text-xs font-medium text-zinc-500">
                {copy.signedInAs}
              </p>

              <p className="mt-1 truncate text-sm font-semibold text-zinc-100">
                {administratorName}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500">
                  {copy.permissionLabel}
                </span>
                <span className="inline-flex min-h-7 items-center rounded-full border border-white/15 bg-white/[0.07] px-2.5 text-[0.7rem] font-bold tracking-[0.08em] text-zinc-200">
                  {permissionText}
                </span>
              </div>

              <div className="mt-5 [&_button]:w-full [&_button]:border-white/15 [&_button]:bg-white/[0.04] [&_button]:text-white [&_button]:hover:bg-white/[0.09] [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-white/70">
                <SignOutButton />
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-zinc-200/80 bg-zinc-50/85 px-4 py-5 pe-28 backdrop-blur sm:px-7 sm:pe-32 lg:px-10 lg:py-7 lg:pe-32 xl:px-14">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  {copy.brand}
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-950">
                  {copy.workspace}
                </p>
              </div>

              <span className="hidden rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-sm sm:inline-flex">
                {permissionText}
              </span>
            </div>
          </header>

          <main
            id="admin-main"
            tabIndex={-1}
            className="px-4 py-8 outline-none sm:px-7 sm:py-10 lg:px-10 lg:py-12 xl:px-14"
          >
            <div className="mx-auto max-w-6xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
