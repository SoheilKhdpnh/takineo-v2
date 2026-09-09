"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/Button";

export function SignOutButton() {
  const router = useRouter();
  const t = useTranslations("SignOut");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignOut() {
    setIsSubmitting(true);

    try {
      const result = await authClient.signOut();

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
    <Button
      variant="ghost"
      size="sm"
      disabled={isSubmitting}
      onClick={() => void handleSignOut()}
    >
      {isSubmitting ? t("submitting") : t("button")}
    </Button>
  );
}
