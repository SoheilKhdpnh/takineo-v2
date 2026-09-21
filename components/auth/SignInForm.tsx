"use client";

import { useTranslations } from "next-intl";
import {
  type FormEvent,
  useId,
  useState,
} from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";
import {
  clearRememberedSignup,
  readRememberedSignup,
  writeRememberedSignup,
} from "@/lib/auth/remembered-signup";
import { isAllowedUsername, normalizeUsername } from "@/lib/domain/username";
import {
  authInputClassName,
  authPrimaryButtonClassName,
} from "@/lib/ui/auth-styles";

function readInitialUsername() {
  return readRememberedSignup()?.username ?? "";
}

export function SignInForm() {
  const router = useRouter();
  const t = useTranslations("Auth");
  const formErrorId = useId();
  const [username, setUsername] = useState(readInitialUsername);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => readRememberedSignup() !== null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);

  const canSubmit = termsAccepted && !isSubmitting && username.trim().length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!termsAccepted) {
      setError(t("signInTermsRequired"));
      return;
    }

    const normalizedUsername = normalizeUsername(username);

    if (!isAllowedUsername(normalizedUsername)) {
      setError(t("usernameInvalid"));
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authClient.signIn.username({
        username: normalizedUsername,
        password,
        rememberMe,
      });

      if (result.error) {
        setError(t("signInError"));
        return;
      }

      if (rememberMe) {
        writeRememberedSignup({
          method: "email",
          username: normalizedUsername,
        });
      } else {
        clearRememberedSignup();
      }

      setWelcomeName(normalizedUsername);
      window.setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1600);
    } catch {
      setError(t("networkError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (welcomeName) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-[#edddd4] bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold tracking-[0.18em] text-[#c2410c] uppercase">
          {t("signInSuccessEyebrow")}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">
          {t("signInSuccessTitle")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          {t("signInWelcome", { username: welcomeName })}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          {t("signInTitle")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {t("signInDescription")}
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="username" className="text-sm font-medium text-zinc-900">
            {t("username")}
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            minLength={3}
            maxLength={30}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={authInputClassName}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-zinc-900">
            {t("password")}
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              dir="ltr"
              autoComplete="current-password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`${authInputClassName} pe-24 text-left`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 end-2 my-auto h-8 rounded-lg px-2 text-xs font-medium text-[#9a3412]"
            >
              {showPassword ? t("hidePassword") : t("showPassword")}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-[#9a3412] underline-offset-4 hover:underline"
          >
            {t("forgotPassword")}
          </Link>
        </div>

        <label className="flex items-start gap-3 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            className="mt-1 size-4 rounded border-zinc-300 text-[#c2410c]"
          />
          <span>
            {t.rich("agreeToTerms", {
              terms: (chunks) => (
                <Link
                  href="/terms"
                  className="font-medium text-[#9a3412] underline-offset-4 hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="mt-1 size-4 rounded border-zinc-300 text-[#c2410c]"
          />
          <span>
            <span className="font-medium">{t("rememberMe")}</span>
            <span className="mt-1 block text-xs text-zinc-500">
              {t("rememberMeHint")}
            </span>
          </span>
        </label>

        {error ? (
          <p
            id={formErrorId}
            role="alert"
            className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={!canSubmit} className={`w-full ${authPrimaryButtonClassName}`}>
          {isSubmitting ? t("signingIn") : t("signIn")}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        {t("notAMember")}{" "}
        <Link
          href="/sign-up"
          className="font-medium text-zinc-950 underline-offset-4 hover:underline"
        >
          {t("createAccount")}
        </Link>
      </p>
    </div>
  );
}
