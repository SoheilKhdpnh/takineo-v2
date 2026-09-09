import { cn } from "@/lib/ui/cn";

export function Rating({
  value,
  max = 5,
  label,
  className,
}: {
  value: number;
  max?: number;
  label: string;
  className?: string;
}) {
  const clamped = Math.min(max, Math.max(0, value));

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("inline-flex items-center gap-0.5 text-accent", className)}
    >
      {Array.from({ length: max }).map((_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={index < clamped ? "opacity-100" : "opacity-25"}
        >
          ★
        </span>
      ))}
    </div>
  );
}
