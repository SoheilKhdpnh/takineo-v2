"use client";

import { useTranslations } from "next-intl";
import {
  type FormEvent,
  useEffect,
  useId,
  useState,
} from "react";

import { IranPhoneField } from "@/components/auth/IranPhoneField";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";
import {
  clearRememberedSignup,
  readRememberedSignup,
  writeRememberedSignup,
} from "@/lib/auth/remembered-signup";
import {
  iranPhoneToInternalEmail,
  isIranMobileNationalNumber,
  normalizeIranMobileNationalNumber,
  toIranE164,
} from "@/lib/domain/iran-phone";
import {
  isAllowedUsername,
  isValidUsernameFormat,
  normalizeUsername,
} from "@/lib/domain/username";

type SignupMethod = "email" | "phone";
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

const USERNAME_TAKEN_CODES = new Set([
  "USERNAME_IS_ALREADY_TAKEN",
  "USERNAME_ALREADY_EXISTS_TO_SIGN_UP",
  "USER_ALREADY_EXISTS_USE_ANOTHER_USERNAME",
]);

function signupErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as { code?: unknown };
  return typeof candidate.code === "string" ? candidate.code : null;
}

function readRememberedFormState() {
  const remembered = readRememberedSignup();

  return {
    method: remembered?.method ?? ("email" as SignupMethod),
    username: remembered?.username ?? "",
    email: remembered?.email ?? "",
    phone: remembered?.phoneNationalNumber ?? "",
    rememberMe: remembered !== null,
  };
}

export function SignUpForm() {
  const router = useRouter();
  const t = useTranslations("Auth");
  const usernameHintId = useId();
  const usernameStatusId = useId();
  const phoneErrorId = useId();
  const formErrorId = useId();
  const [initialRemembered] = useState(readRememberedFormState);

  const [method, setMethod] = useState<SignupMethod>(initialRemembered.method);
  const [username, setUsername] = useState(initialRemembered.username);
  const [email, setEmail] = useState(initialRemembered.email);
  const [phone, setPhone] = useState(initialRemembered.phone);
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [rememberMe, setRememberMe] = useState(initialRemembered.rememberMe);
  const [availability, setAvailability] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedUsername = normalizeUsername(username);
  const usernameStatus: UsernameStatus = !normalizedUsername
    ? "idle"
    : !isValidUsernameFormat(normalizedUsername)
      ? "invalid"
      : !isAllowedUsername(normalizedUsername)
        ? "taken"
        : availability;

  useEffect(() => {
    if (!normalizedUsername || !isAllowedUsername(normalizedUsername)) {
      return;
    }

    const handle = window.setTimeout(async () => {
      setAvailability("checking");

      try {
        const response = await fetch(
          `/api/usernames/availability?username=${encodeURIComponent(normalizedUsername)}`,
        );
        const payload = (await response.json()) as {
          available?: boolean;
          error?: string;
        };

        if (payload.error === "USERNAME_TAKEN" || payload.available === false) {
          setAvailability("taken");
          return;
        }

        if (payload.available) {
          setAvailability("available");
          return;
        }

        setAvailability("idle");
      } catch {
        setAvailability("idle");
      }
    }, 400);

    return () => window.clearTimeout(handle);
  }, [normalizedUsername]);

  const usernameTaken = usernameStatus === "taken";
  const canSubmit =
    termsAccepted &&
    !isSubmitting &&
    !usernameTaken &&
    usernameStatus !== "invalid" &&
    usernameStatus !== "checking";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPhoneError(null);

    if (!termsAccepted) {
      setError(t("termsRequired"));
      return;
    }

    if (!isAllowedUsername(normalizedUsername) || usernameTaken) {
      if (usernameTaken) {
        setAvailability("taken");
      }
      return;
    }

    let phoneE164: string | undefined;
    let signupEmail = email.trim().toLowerCase();

    if (method === "phone") {
      const nationalNumber = normalizeIranMobileNationalNumber(phone);

      if (!isIranMobileNationalNumber(nationalNumber)) {
        setPhoneError(t("phoneInvalid"));
        return;
      }

      phoneE164 = toIranE164(nationalNumber);
      signupEmail = iranPhoneToInternalEmail(phoneE164);
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: normalizedUsername,
        username: normalizedUsername,
        email: signupEmail,
        password,
        termsAccepted: true,
        rememberMe,
        ...(phoneE164 ? { phoneNumber: phoneE164 } : {}),
      };

      const result = await authClient.signUp.email(payload);

      if (result.error) {
        const code = signupErrorCode(result.error);

        if (code && USERNAME_TAKEN_CODES.has(code)) {
          setAvailability("taken");
          return;
        }

        if (code === "INVALID_PHONE_NUMBER") {
          setPhoneError(t("phoneInvalid"));
          return;
        }

        if (code === "TERMS_NOT_ACCEPTED") {
          setError(t("termsRequired"));
          return;
        }

        setError(t("signUpError"));
        return;
      }

      if (rememberMe) {
        writeRememberedSignup({
          method,
          username: normalizedUsername,
          email: method === "email" ? signupEmail : undefined,
          phoneNationalNumber:
            method === "phone"
              ? normalizeIranMobileNationalNumber(phone)
              : undefined,
        });
      } else {
        clearRememberedSignup();
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
    <div className="w-full max-w-md">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          {t("signUpTitle")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {t("signUpDescription")}
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          setMethod(method === "phone" ? "email" : "phone");
          setError(null);
          setPhoneError(null);
        }}
        className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[#edddd4] bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-[#fff4ed]"
      >
        {method === "phone" ? t("signUpWithEmail") : t("signUpWithPhone")}
      </button>

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
            aria-invalid={
              usernameStatus === "taken" || usernameStatus === "invalid"
                ? true
                : undefined
            }
            aria-describedby={`${usernameHintId} ${usernameStatusId}`}
            onChange={(event) => {
              setUsername(event.target.value);
              setAvailability("idle");
            }}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-zinc-950 outline-none transition focus:border-zinc-950"
          />
          <p id={usernameHintId} className="text-xs text-zinc-500">
            {t("usernameHint")}
          </p>
          <p
            id={usernameStatusId}
            role={
              usernameStatus === "taken" || usernameStatus === "invalid"
                ? "alert"
                : undefined
            }
            className={
              usernameStatus === "taken" || usernameStatus === "invalid"
                ? "text-xs text-red-700"
                : usernameStatus === "available"
                  ? "text-xs text-emerald-700"
                  : "text-xs text-zinc-500"
            }
          >
            {usernameStatus === "checking"
              ? t("usernameChecking")
              : usernameStatus === "taken"
                ? t("usernameTaken")
                : usernameStatus === "invalid"
                  ? t("usernameInvalid")
                  : usernameStatus === "available"
                    ? t("usernameAvailable")
                    : null}
          </p>
        </div>

        {method === "phone" ? (
          <IranPhoneField
            id="phone"
            label={t("phoneLabel")}
            hint={t("phoneHint")}
            countryLabel={t("countryIran")}
            value={phone}
            invalid={Boolean(phoneError)}
            describedBy={phoneError ? phoneErrorId : "phone-hint"}
            onChange={(value) => {
              setPhone(value);
              setPhoneError(null);
            }}
          />
        ) : (
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-zinc-900">
              {t("email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-left text-zinc-950 outline-none transition focus:border-zinc-950"
            />
          </div>
        )}

        {phoneError ? (
          <p id={phoneErrorId} role="alert" className="text-sm text-red-700">
            {phoneError}
          </p>
        ) : null}

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-zinc-900">
            {t("password")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-left text-zinc-950 outline-none transition focus:border-zinc-950"
          />
          <p className="text-xs text-zinc-500">{t("passwordHint")}</p>
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

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-xl bg-[#c2410c] px-4 py-3 font-medium text-white transition hover:bg-[#9a3412] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? t("creatingAccount") : t("createAccount")}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        {t("alreadyHaveAccount")}{" "}
        <Link
          href="/sign-in"
          className="font-medium text-zinc-950 underline-offset-4 hover:underline"
        >
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
