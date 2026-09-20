import type { ReactNode } from "react";
import Image from "next/image";

interface AuthSplitLayoutProps {
  brand: string;
  photoTitle: string;
  photoSubtitle: string;
  children: ReactNode;
}

export function AuthSplitLayout({
  brand,
  photoTitle,
  photoSubtitle,
  children,
}: AuthSplitLayoutProps) {
  return (
    <main className="grid min-h-screen bg-[#1c1410] lg:grid-cols-[minmax(24rem,32rem)_1fr]">
      <div className="relative isolate h-44 overflow-hidden lg:hidden">
        <Image
          src="/images/auth-signup-background.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#fffaf6] via-black/20 to-black/30" />
        <p className="absolute bottom-4 start-5 text-sm font-semibold tracking-[0.18em] text-white uppercase">
          {brand}
        </p>
      </div>

      <section className="relative z-10 flex min-h-0 flex-col justify-center bg-[#fffaf6] px-5 py-10 sm:px-10 lg:min-h-screen lg:py-16">
        <p className="mb-8 hidden text-sm font-semibold tracking-[0.18em] text-[#c2410c] uppercase lg:block">
          {brand}
        </p>
        {children}
      </section>

      <aside className="relative hidden min-h-screen overflow-hidden lg:block">
        <Image
          src="/images/auth-signup-background.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <p className="max-w-md text-3xl font-semibold tracking-tight text-balance">
            {photoTitle}
          </p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/80">
            {photoSubtitle}
          </p>
        </div>
      </aside>
    </main>
  );
}
