import Image from "next/image";
import type { ComponentPropsWithoutRef } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/ui/cn";

function isInternalPath(href: string): boolean {
  return href.startsWith("/");
}

export const blogMdxComponents = {
  h2: ({
    className,
    ...props
  }: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className={cn("mt-10 text-2xl text-ink", className)}
      {...props}
    />
  ),
  h3: ({
    className,
    ...props
  }: ComponentPropsWithoutRef<"h3">) => (
    <h3
      className={cn("mt-8 text-xl text-ink", className)}
      {...props}
    />
  ),
  p: ({
    className,
    ...props
  }: ComponentPropsWithoutRef<"p">) => (
    <p
      className={cn(
        "mt-5 text-base leading-8 text-ink-muted",
        className,
      )}
      {...props}
    />
  ),
  ul: ({
    className,
    ...props
  }: ComponentPropsWithoutRef<"ul">) => (
    <ul
      className={cn(
        "mt-5 list-disc space-y-2 ps-6 text-ink-muted",
        className,
      )}
      {...props}
    />
  ),
  ol: ({
    className,
    ...props
  }: ComponentPropsWithoutRef<"ol">) => (
    <ol
      className={cn(
        "mt-5 list-decimal space-y-2 ps-6 text-ink-muted",
        className,
      )}
      {...props}
    />
  ),
  li: ({
    className,
    ...props
  }: ComponentPropsWithoutRef<"li">) => (
    <li className={cn("leading-7", className)} {...props} />
  ),
  a: ({
    href,
    className,
    ...props
  }: ComponentPropsWithoutRef<"a">) => {
    const classNames = cn(
      "font-semibold text-primary underline-offset-4 hover:underline",
      className,
    );

    if (href && isInternalPath(href)) {
      return (
        <Link href={href} className={classNames} {...props} />
      );
    }

    return (
      <a
        href={href}
        className={classNames}
        rel="noreferrer"
        target="_blank"
        {...props}
      />
    );
  },
  img: ({
    src,
    alt,
  }: ComponentPropsWithoutRef<"img">) => {
    if (typeof src !== "string" || src.length === 0) {
      return null;
    }

    return (
      <span className="relative mt-8 block overflow-hidden rounded-lg border border-line">
        <Image
          src={src}
          alt={alt ?? ""}
          width={960}
          height={540}
          sizes="(max-width: 768px) 100vw, 720px"
          className="h-auto w-full object-cover"
        />
      </span>
    );
  },
  blockquote: ({
    className,
    ...props
  }: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className={cn(
        "mt-6 border-s-2 border-primary bg-mint/50 px-5 py-4 text-ink",
        className,
      )}
      {...props}
    />
  ),
};
