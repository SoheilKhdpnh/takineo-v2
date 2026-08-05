"use client";

import {
  useTranslations,
} from "next-intl";
import {
  type FormEvent,
  useState,
} from "react";

import {
  Link,
  useRouter,
} from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const router = useRouter();
  const t = useTranslations("Auth");

  const [error, setError] =
    useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(
      event.currentTarget,
    );

    const email = String(
      formData.get("email") ?? "",
    )
      .trim()
      .toLowerCase();

    const password = String(
      formData.get("password") ?? "",
    );

    try {
      const result =
        await authClient.signIn.email({
          email,
          password,
          rememberMe: true,
        });

      if (result.error) {
        setError(t("signInError"));
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("networkError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            {t("signInTitle")}
          </h1>

          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {t("signInDescription")}
          </p>
        </div>

        <form
          className="space-y-5"
          onSubmit={handleSubmit}
        >
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-zinc-900"
            >
              {t("email")}
            </label>

            <input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-left text-zinc-950 outline-none transition focus:border-zinc-950"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-zinc-900"
            >
              {t("password")}
            </label>

            <input
              id="password"
              name="password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              required
              minLength={8}
              maxLength={128}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-left text-zinc-950 outline-none transition focus:border-zinc-950"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-zinc-950 px-4 py-2.5 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? t("signingIn")
              : t("signIn")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600">
          {t("needAccount")}{" "}
          <Link
            href="/sign-up"
            className="font-medium text-zinc-950 underline-offset-4 hover:underline"
          >
            {t("createAccount")}
          </Link>
        </p>
      </section>
    </main>
  );
}