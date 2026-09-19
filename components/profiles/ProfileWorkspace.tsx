import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import {
  PROFILE_TIMEZONES,
  type ProfileTimezone,
} from "@/lib/domain/profile";
import { cn } from "@/lib/ui/cn";

export type ProfileNavItem = {
  id: string;
  label: string;
  complete: boolean;
};

export const PROFILE_TIMEZONE_LABEL_KEYS = {
  "Asia/Tehran": "timezoneLabels.Asia_Tehran",
  "Asia/Dubai": "timezoneLabels.Asia_Dubai",
  "Europe/Berlin": "timezoneLabels.Europe_Berlin",
  "Europe/Istanbul": "timezoneLabels.Europe_Istanbul",
  "Europe/London": "timezoneLabels.Europe_London",
  "America/Toronto": "timezoneLabels.America_Toronto",
  "America/New_York": "timezoneLabels.America_New_York",
  "America/Chicago": "timezoneLabels.America_Chicago",
  "America/Los_Angeles": "timezoneLabels.America_Los_Angeles",
  UTC: "timezoneLabels.UTC",
} as const satisfies Record<ProfileTimezone, string>;

export function fieldClassName(multiline = false) {
  return cn(
    "w-full rounded-md border border-line bg-canvas px-3 py-2.5 text-ink outline-none transition",
    "placeholder:text-ink-muted/70",
    "focus:border-primary",
    multiline && "min-h-36 resize-y leading-7",
  );
}

export function ProfileWorkspace({
  eyebrow,
  title,
  description,
  completenessLabel,
  completeness,
  navLabel,
  nav,
  preview,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  completenessLabel: string;
  completeness: number;
  navLabel: string;
  nav: ProfileNavItem[];
  preview: ReactNode;
  children: ReactNode;
}) {
  const clamped = Math.min(100, Math.max(0, completeness));

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="rounded-lg border border-line bg-surface p-6 sm:p-8">
          <p className="text-sm font-medium text-primary">{eyebrow}</p>
          <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl tracking-tight text-ink sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 leading-7 text-ink-muted">{description}</p>
            </div>
            <div className="w-full max-w-xs">
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-ink">
                <span>{completenessLabel}</span>
                <span dir="ltr">{clamped}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-mint">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${clamped}%` }}
                />
              </div>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[16rem_minmax(0,1fr)_20rem] xl:items-start">
          <nav
            aria-label={navLabel}
            className="order-2 rounded-lg border border-line bg-surface p-3 xl:order-none xl:sticky xl:top-6"
          >
            <ul className="flex gap-2 overflow-x-auto xl:flex-col xl:overflow-visible">
              {nav.map((item) => (
                <li key={item.id} className="shrink-0 xl:shrink">
                  <a
                    href={`#${item.id}`}
                    className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-ink transition hover:bg-mint"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full text-[11px]",
                        item.complete
                          ? "bg-primary text-white"
                          : "border border-line bg-canvas text-ink-muted",
                      )}
                    >
                      {item.complete ? "✓" : ""}
                    </span>
                    <span>{item.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="order-3 min-w-0 xl:order-none">{children}</div>

          <aside className="order-1 xl:order-none xl:sticky xl:top-6">{preview}</aside>
        </div>
      </div>
    </div>
  );
}

export function ProfileSection({
  id,
  title,
  hint,
  audienceLabel,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  audienceLabel?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-lg border border-line bg-surface p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            {hint}
          </p>
        </div>
        {audienceLabel ? (
          <p className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
            {audienceLabel}
          </p>
        ) : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function ProfilePreviewCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      data-testid="profile-preview"
      className="rounded-lg border border-line bg-surface p-5 shadow-[0_18px_50px_-36px_rgba(20,34,31,0.35)]"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {title}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ProfileSaveBar({
  label,
  disabled,
}: {
  label: string;
  disabled: boolean;
}) {
  return (
    <div className="border-t border-line bg-surface pt-4 xl:sticky xl:bottom-4 xl:z-10 xl:rounded-lg xl:border xl:p-4 xl:shadow-[0_18px_50px_-36px_rgba(20,34,31,0.45)] xl:backdrop-blur">
      <Button type="submit" size="lg" disabled={disabled} className="w-full sm:w-auto">
        {label}
      </Button>
    </div>
  );
}

export function ProfileTimezoneOptions({
  labelFor,
}: {
  labelFor: (timezone: ProfileTimezone) => string;
}) {
  return (
    <>
      {PROFILE_TIMEZONES.map((zone) => (
        <option key={zone} value={zone}>
          {labelFor(zone)}
        </option>
      ))}
    </>
  );
}
