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
    <main className="flex justify-center px-4 py-12">
      <section className="w-full max-w-lg rounded-lg border border-line bg-surface p-8 text-center">
        <p className="text-sm font-medium text-primary">
          {t("eyebrow")}
        </p>

        <h1 className="mt-3 text-2xl font-semibold text-ink">
          {t("title")}
        </h1>

        <p className="mt-3 leading-7 text-ink-muted">
          {t("description")}
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-md bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover"
        >
          {t("retry")}
        </button>

        {error.digest ? (
          <p className="mt-4 text-xs text-ink-muted">
            {t("reference", {
              digest: error.digest,
            })}
          </p>
        ) : null}
      </section>
    </main>
  );
}