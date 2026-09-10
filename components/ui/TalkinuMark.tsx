import { cn } from "@/lib/ui/cn";

/**
 * Talkinu icon mark: two overlapping geometric speech bubbles.
 *
 * Concepts considered:
 * 1. Stylized "T" in a squircle — too Latin-centric beside تاکینو.
 * 2. Linked nodes / abstract connection — too generic for a speaking product.
 * 3. Facing speech bubbles (chosen) — language-agnostic, readable at 16px,
 *    and reads as conversation in both LTR and RTL headers.
 */
export function TalkinuMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  const labelled = Boolean(title);

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-9 shrink-0 text-primary", className)}
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-label={title}
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <rect x="14" y="6" width="12.5" height="9.5" rx="3.5" fill="#fffdf8" />
      <rect x="5.5" y="11.5" width="18" height="12.5" rx="4" fill="#fffdf8" />
      <path fill="#fffdf8" d="M8 23.5v4.4L13.2 23.5H8Z" />
    </svg>
  );
}

export function TalkinuWordmark({
  brand,
  className,
  markClassName,
}: {
  brand: string;
  className?: string;
  markClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5",
        className,
      )}
    >
      <TalkinuMark className={markClassName} />
      <span className="text-base font-semibold tracking-tight text-ink">
        {brand}
      </span>
    </span>
  );
}
