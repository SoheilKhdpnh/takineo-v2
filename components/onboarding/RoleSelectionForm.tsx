"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import type { UserRole } from "@/lib/domain/user-role";

export function RoleSelectionForm() {
  const router = useRouter();
  const t = useTranslations("Onboarding");

  const [selectedRole, setSelectedRole] =
    useState<UserRole | null>(null);
  const [error, setError] =
    useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] =
    useState(false);

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
      const response = await fetch(
        "/api/onboarding",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            role: selectedRole,
          }),
        },
      );

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

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("networkError"));
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div
        className="grid gap-4 sm:grid-cols-2"
        role="radiogroup"
        aria-label={t("roleGroupLabel")}
      >
        {roleOptions.map((option) => {
          const isSelected =
            selectedRole === option.role;

          return (
            <button
              key={option.role}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isSubmitting}
              onClick={() =>
                setSelectedRole(option.role)
              }
              className={[
                "rounded-lg border p-5 text-start transition",
                "disabled:cursor-not-allowed disabled:opacity-60",
                isSelected
                  ? "border-primary bg-primary text-white"
                  : "border-line bg-surface text-ink hover:border-primary",
              ].join(" ")}
            >
              <span className="block text-lg font-semibold">
                {option.title}
              </span>

              <span
                className={[
                  "mt-2 block text-sm leading-6",
                  isSelected
                    ? "text-mint"
                    : "text-ink-muted",
                ].join(" ")}
              >
                {option.description}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-sm leading-6 text-ink-muted">
        {t("selectionHint")}
      </p>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!selectedRole || isSubmitting}
        onClick={handleSubmit}
        className="w-full rounded-md bg-primary px-4 py-3 font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? t("creatingWorkspace")
          : t("continue")}
      </button>
    </div>
  );
}