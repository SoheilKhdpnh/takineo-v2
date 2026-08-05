"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const t = useTranslations("SignOut");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  async function handleSignOut() {
    setIsSubmitting(true);

    try {
      const result =
        await authClient.signOut();

      if (result.error) {
        setIsSubmitting(false);
        return;
      }

      router.push("/sign-in");
      router.refresh();
    } catch {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      disabled={isSubmitting}
      onClick={handleSignOut}
      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSubmitting
        ? t("submitting")
        : t("button")}
    </button>
  );
}