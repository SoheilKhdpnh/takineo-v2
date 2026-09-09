"use client";

import { useTranslations } from "next-intl";
import {
  type FormEvent,
  useState,
} from "react";

import { buttonClassName } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TalkinuMark } from "@/components/ui/TalkinuMark";
import {
  Link,
  useRouter,
} from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  const router = useRouter();
  const t = useTranslations("Auth");
  const brand = useTranslations("Common");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");

    try {
      const result = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (result.error) {
        setError(t("signUpError"));
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
    <main className="flex justify-center px-4 py-12 sm:py-16">
      <section className="w-full max-w-md rounded-lg border border-line bg-surface p-8 shadow-[0_18px_50px_-36px_rgba(20,34,31,0.35)]">
        <TalkinuMark />
        <p className="mt-4 text-sm font-semibold text-primary">
          {brand("brand")}
        </p>
        <h1 className="mt-2 text-3xl tracking-tight text-ink">
          {t("signUpTitle")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          {t("signUpDescription")}
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-ink">
              {t("name")}
            </label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-ink">
              {t("email")}
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              required
              className="text-left"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-ink">
              {t("password")}
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              className="text-left"
            />
            <p className="text-xs text-ink-muted">{t("passwordHint")}</p>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className={buttonClassName({
              className: "w-full",
            })}
          >
            {isSubmitting ? t("creatingAccount") : t("createAccount")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          {t("alreadyHaveAccount")}{" "}
          <Link
            href="/sign-in"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t("signIn")}
          </Link>
        </p>
      </section>
    </main>
  );
}
