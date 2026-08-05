"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

interface AppErrorProps {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}

export default function AppError({
  error,
  reset,
}: AppErrorProps) {
  const t = useTranslations("Error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-zinc-500">
          {t("eyebrow")}
        </p>

        <h1 className="mt-3 text-2xl font-semibold text-zinc-950">
          {t("title")}
        </h1>

        <p className="mt-3 leading-7 text-zinc-600">
          {t("description")}
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-zinc-950 px-5 py-2.5 font-medium text-white transition hover:bg-zinc-800"
        >
          {t("retry")}
        </button>

        {error.digest ? (
          <p className="mt-4 text-xs text-zinc-400">
            {t("reference", {
              digest: error.digest,
            })}
          </p>
        ) : null}
      </section>
    </main>
  );
}