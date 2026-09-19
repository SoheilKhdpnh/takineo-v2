import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/ui/cn";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-line bg-surface px-3 py-2.5 text-ink outline-none transition",
        "placeholder:text-ink-muted/70",
        "focus:border-primary",
        className,
      )}
      {...props}
    />
  );
}
