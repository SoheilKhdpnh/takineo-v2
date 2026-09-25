"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { TalkinuWordmark } from "@/components/ui/TalkinuMark";
import {
  CalendarIcon,
  ChatIcon,
  ClipboardIcon,
  CloseIcon,
  MenuIcon,
  UserIcon,
  VideoIcon,
} from "@/components/ui/WorkspaceIcons";
import { Link, usePathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/ui/cn";

type NavKey =
  | "profile"
  | "schedule"
  | "sessions"
  | "application"
  | "video";

const NAV_ITEMS: {
  key: NavKey;
  href: string;
  matches: string[];
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  {
    key: "profile",
    href: "/teacher/profile",
    matches: ["/teacher/profile", "/teacher/dashboard"],
    Icon: UserIcon,
  },
  {
    key: "schedule",
    href: "/teacher/profile#schedule",
    matches: [],
    Icon: CalendarIcon,
  },
  {
    key: "sessions",
    href: "/teacher/profile#sessions",
    matches: [],
    Icon: ChatIcon,
  },
  {
    key: "application",
    href: "/teacher/profile#application",
    matches: [],
    Icon: ClipboardIcon,
  },
  {
    key: "video",
    href: "/teacher/video",
    matches: ["/teacher/video"],
    Icon: VideoIcon,
  },
];

export function TeacherWorkspaceShell({
  locale,
  userName,
  userImage,
  children,
}: {
  locale: AppLocale;
  userName: string;
  userImage: string | null;
  children: ReactNode;
}) {
  const t = useTranslations("TeacherWorkspace");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName =
    userName.trim().length > 0 ? userName.trim() : t("teacherFallback");

  return (
    <div className="min-h-screen bg-[#fffaf6] text-ink lg:flex">
      <aside
        id="teacher-workspace-sidebar"
        className={cn(
          "fixed inset-y-0 start-0 z-40 flex w-[17.5rem] flex-col border-e border-[#edddd4] bg-[linear-gradient(180deg,#ffffff_0%,#fff7f1_55%,#fff1e6_100%)] transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:shrink-0",
          mobileOpen
            ? "translate-x-0"
            : "max-lg:-translate-x-full max-lg:rtl:translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-6 pb-5">
          <Link
            href="/"
            className="rounded-lg"
            onClick={() => setMobileOpen(false)}
          >
            <TalkinuWordmark
              brand={t("brand")}
              markClassName="size-10"
              textClassName="text-lg font-bold"
            />
          </Link>
          <button
            type="button"
            aria-label={t("closeMenu")}
            className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-[#fff4ed] lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <CloseIcon />
          </button>
        </div>

        <p className="px-6 text-xs font-medium text-zinc-500">
          {t("tagline")}
        </p>

        <nav
          aria-label={t("navigationLabel")}
          className="mt-5 flex flex-col gap-1 px-3"
        >
          {NAV_ITEMS.map(({ key, href, matches, Icon }) => {
            const active = matches.some(
              (match) =>
                pathname === match || pathname.startsWith(`${match}/`),
            );

            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  active
                    ? "bg-[#c2410c] text-white shadow-[0_12px_24px_-16px_rgba(194,65,12,0.95)]"
                    : "text-zinc-600 hover:bg-white hover:text-[#9a3412] hover:shadow-sm",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-lg transition",
                    active
                      ? "bg-white/15"
                      : "bg-[#fff4ed] text-[#c2410c] group-hover:bg-[#ffedd5]",
                  )}
                >
                  <Icon className="size-[1.125rem]" />
                </span>
                {t(`nav.${key}`)}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-4">
          <figure className="relative isolate overflow-hidden rounded-2xl shadow-[0_18px_40px_-24px_rgba(28,20,16,0.6)]">
            <Image
              src="/images/teacher-journey-mountain.png"
              alt=""
              fill
              sizes="16rem"
              className="-z-10 object-cover"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#1c1410]/90 via-[#1c1410]/45 to-transparent" />
            <blockquote className="px-4 pt-24 text-sm leading-6 font-medium text-white">
              “{t("journeyQuote")}”
            </blockquote>
            <figcaption className="px-4 pt-2 pb-4 text-xs font-semibold text-[#fed7aa]">
              {t("journeyAttribution")}
            </figcaption>
          </figure>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          aria-label={t("closeMenu")}
          className="fixed inset-0 z-30 bg-[#1c1410]/40 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[#edddd4] bg-[#fffaf6]/90 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            aria-controls="teacher-workspace-sidebar"
            aria-expanded={mobileOpen}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#edddd4] bg-white px-3 text-sm font-semibold text-ink lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon className="size-[1.125rem]" />
            {t("openMenu")}
          </button>

          <div className="ms-auto flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher currentLocale={locale} />
            <div className="hidden items-center gap-3 rounded-full border border-[#edddd4] bg-white py-1.5 pe-3 ps-1.5 sm:flex">
              {userImage ? (
                // Better Auth profile images may come from arbitrary provider URLs.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userImage}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid size-8 place-items-center rounded-full bg-[#c2410c] text-xs font-bold text-white"
                >
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  {displayName}
                </span>
                <span className="block text-xs text-ink-muted">
                  {t("roleTeacher")}
                </span>
              </span>
            </div>
            <SignOutButton />
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
