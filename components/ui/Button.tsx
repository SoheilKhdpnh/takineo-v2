import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

import { cn } from "@/lib/ui/cn";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost";

type ButtonSize =
  | "sm"
  | "md"
  | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover disabled:bg-primary/50",
  secondary:
    "border border-line bg-surface text-ink hover:border-primary hover:bg-mint disabled:opacity-50",
  ghost:
    "bg-transparent text-ink hover:bg-mint disabled:opacity-50",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "min-h-10 px-3.5 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold transition",
        "disabled:cursor-not-allowed",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    />
  );
}

export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex items-center justify-center rounded-md font-semibold transition",
    "disabled:cursor-not-allowed",
    variantClass[variant],
    sizeClass[size],
    className,
  );
}

export function ButtonRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap",
        className,
      )}
    >
      {children}
    </div>
  );
}
