import type { HTMLAttributes } from "react";

import { cn } from "@/lib/ui/cn";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-lg border border-line bg-surface p-5 shadow-[0_18px_50px_-36px_rgba(20,34,31,0.35)] sm:p-6",
        className,
      )}
      {...props}
    />
  );
}
