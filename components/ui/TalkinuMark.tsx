import { cn } from "@/lib/ui/cn";

export function TalkinuMark({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 place-items-center rounded-md bg-primary text-sm font-extrabold tracking-[-0.06em] text-white",
        className,
      )}
    >
      T
    </span>
  );
}
