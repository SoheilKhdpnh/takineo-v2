import type { ReactNode } from "react";
import Image from "next/image";

export type AuthSplitQuote = {
  text: string;
  attribution?: string;
};

interface AuthSplitLayoutProps {
  brand: string;
  photoTitle: string;
  photoSubtitle: string;
  children: ReactNode;
  aside?: "photo" | "quotes";
  quotes?: AuthSplitQuote[];
}

export function AuthSplitLayout({
  brand,
  photoTitle,
  photoSubtitle,
  children,
  aside = "photo",
  quotes = [],
}: AuthSplitLayoutProps) {
  const useQuotes = aside === "quotes";

  return (
    <main className="grid min-h-screen bg-[#1c1410] lg:grid-cols-[minmax(24rem,32rem)_1fr]">
      <div className="relative isolate h-44 overflow-hidden lg:hidden">
        {useQuotes ? (
          <div className="absolute inset-0 bg-gradient-to-br from-[#9a3412] via-[#c2410c] to-[#1c1410]" />
        ) : (
          <Image
            src="/images/auth-signup-background.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
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
        {useQuotes ? (
          <div className="flex h-full flex-col justify-end bg-gradient-to-br from-[#7c2d12] via-[#c2410c] to-[#1c1410] p-10 text-white">
            <p className="max-w-md text-3xl font-semibold tracking-tight text-balance">
              {photoTitle}
            </p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/80">
              {photoSubtitle}
            </p>
            <ul className="mt-10 space-y-5">
              {quotes.map((quote) => (
                <li
                  key={quote.text}
                  className="max-w-md rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm"
                >
                  <p className="text-base leading-7 text-white/95">
                    “{quote.text}”
                  </p>
                  {quote.attribution ? (
                    <p className="mt-3 text-xs font-medium tracking-wide text-white/70">
                      {quote.attribution}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
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
          </>
        )}
      </aside>
    </main>
  );
}
