import Image from "next/image";

import { buttonClassName } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";

export function HomeHero({
  eyebrow,
  title,
  description,
  findTeacher,
  createAccount,
  imageAlt,
}: {
  eyebrow: string;
  title: string;
  description: string;
  findTeacher: string;
  createAccount: string;
  imageAlt: string;
}) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -end-24 -top-28 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -start-20 bottom-0 size-[22rem] rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute start-1/2 top-12 size-[18rem] -translate-x-1/2 rounded-full bg-mint/80 blur-2xl" />
        <svg
          className="absolute end-[-4rem] top-8 hidden h-[28rem] w-[28rem] text-primary/10 lg:block"
          viewBox="0 0 320 320"
          fill="none"
        >
          <circle cx="160" cy="160" r="118" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="160" cy="160" r="78" stroke="currentColor" strokeWidth="1.5" />
          <rect
            x="86"
            y="86"
            width="148"
            height="148"
            rx="36"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-12 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-2 lg:gap-14 lg:pb-16">
        <div>
          <p className="text-sm font-semibold text-primary">{eyebrow}</p>
          <h1 className="mt-4 max-w-xl text-4xl text-ink sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-ink-muted">
            {description}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/teachers"
              className={buttonClassName({
                size: "lg",
              })}
            >
              {findTeacher}
            </Link>
            <Link
              href="/sign-up"
              className={buttonClassName({
                variant: "secondary",
                size: "lg",
              })}
            >
              {createAccount}
            </Link>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-line bg-surface shadow-[0_24px_60px_-32px_rgba(20,34,31,0.45)]">
          <Image
            src="/images/home/hero-conversation.webp"
            alt={imageAlt}
            width={1280}
            height={720}
            priority
            quality={70}
            sizes="(max-width: 1024px) 100vw, 540px"
            className="h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-accent/10"
          />
        </div>
      </div>
    </section>
  );
}
