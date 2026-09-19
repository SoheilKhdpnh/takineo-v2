import type { HTMLAttributes } from "react";

import { cn } from "@/lib/ui/cn";

type BadgeTone =
  | "neutral"
  | "mint"
  | "accent";

const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-canvas text-ink-muted",
  mint: "bg-mint text-primary",
  accent: "bg-accent-soft text-accent",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
