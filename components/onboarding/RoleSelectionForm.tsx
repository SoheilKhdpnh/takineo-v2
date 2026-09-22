"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { UserRole } from "@/lib/domain/user-role";
import {
  authPrimaryButtonClassName,
} from "@/lib/ui/auth-styles";

export function RoleSelectionForm() {
  const router = useRouter();
  const t = useTranslations("Onboarding");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roleOptions: Array<{
    role: UserRole;
    title: string;
    description: string;
  }> = [
    {
      role: "STUDENT",
      title: t("studentTitle"),
      description: t("studentDescription"),
    },
    {
      role: "TEACHER",
      title: t("teacherTitle"),
      description: t("teacherDescription"),
    },
  ];

  async function handleSubmit() {
    if (!selectedRole) {
      setError(t("selectRoleError"));
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: selectedRole,
        }),
      });

      if (response.status === 401) {
        router.push("/sign-in");
        router.refresh();
        return;
      }

      if (!response.ok) {
        setError(t("genericError"));
        setIsSubmitting(false);
        return;
      }

      router.push(
        selectedRole === "STUDENT"
          ? "/onboarding/student"
          : "/onboarding/teacher",
      );
      router.refresh();
    } catch {
      setError(t("networkError"));
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div
        className="grid gap-4"
        role="radiogroup"
        aria-label={t("roleGroupLabel")}
      >
        {roleOptions.map((option) => {
          const isSelected = selectedRole === option.role;

          return (
            <button
              key={option.role}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isSubmitting}
              onClick={() => setSelectedRole(option.role)}
              className={[
                "rounded-2xl border p-5 text-start transition",
                "disabled:cursor-not-allowed disabled:opacity-60",
                isSelected
                  ? "border-[#c2410c] bg-[#c2410c] text-white"
                  : "border-[#edddd4] bg-white text-zinc-950 hover:border-[#c2410c]",
              ].join(" ")}
            >
              <span className="block text-lg font-semibold">
                {option.title}
              </span>
              <span
                className={[
                  "mt-2 block text-sm leading-6",
                  isSelected ? "text-white/85" : "text-zinc-600",
                ].join(" ")}
              >
                {option.description}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-sm leading-6 text-zinc-600">{t("selectionHint")}</p>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!selectedRole || isSubmitting}
        onClick={handleSubmit}
        className={`w-full ${authPrimaryButtonClassName}`}
      >
        {isSubmitting ? t("creatingWorkspace") : t("continue")}
      </button>
    </div>
  );
}
