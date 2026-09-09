import { cn } from "@/lib/ui/cn";

export function initialsFor(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "T";
  }

  return parts
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();
}

type AvatarSize = "sm" | "md" | "lg";

const sizeClass: Record<AvatarSize, string> = {
  sm: "size-11 text-sm",
  md: "size-14 text-sm",
  lg: "size-24 text-2xl",
};

const dimension: Record<AvatarSize, number> = {
  sm: 44,
  md: 56,
  lg: 96,
};

export function Avatar({
  name,
  image,
  size = "md",
  className,
}: {
  name: string;
  image: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const initials = initialsFor(name);
  const pixels = dimension[size];

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md bg-ink text-white",
        sizeClass[size],
        className,
      )}
    >
      {image ? (
        // Discovery photos may come from arbitrary Better Auth image URLs.
        // Keep a sized img until remote hosts are an explicit product decision.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          width={pixels}
          height={pixels}
          className="size-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-full items-center justify-center font-bold"
        >
          {initials}
        </span>
      )}
    </div>
  );
}
