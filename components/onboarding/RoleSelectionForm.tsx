"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { UserRole } from "@/lib/domain/user-role";

const roleOptions: Array<{
  role: UserRole;
  title: string;
  description: string;
}> = [
  {
    role: "STUDENT",
    title: "I want to learn",
    description:
      "Find teachers, book 15-minute speaking sessions, and receive personalized feedback.",
  },
  {
    role: "TEACHER",
    title: "I want to teach",
    description:
      "Create availability, lead speaking sessions, and review AI-assisted feedback.",
  },
];

export function RoleSelectionForm() {
  const router = useRouter();

  const [selectedRole, setSelectedRole] =
    useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  async function handleSubmit() {
    if (!selectedRole) {
      setError("Select a role before continuing.");
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

      const payload = (await response
        .json()
        .catch(() => null)) as {
        error?: string;
      } | null;

      if (response.status === 401) {
        router.push("/sign-in");
        router.refresh();
        return;
      }

      if (!response.ok) {
        setError(
          payload?.error ??
            "Unable to complete onboarding.",
        );
        setIsSubmitting(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(
        "A network error prevented onboarding.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div
        className="grid gap-4 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Choose your Takineo role"
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
                "rounded-2xl border p-5 text-left transition",
                "disabled:cursor-not-allowed disabled:opacity-60",
                isSelected
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-950 hover:border-zinc-400",
              ].join(" ")}
            >
              <span className="block text-lg font-semibold">
                {option.title}
              </span>

              <span
                className={[
                  "mt-2 block text-sm leading-6",
                  isSelected
                    ? "text-zinc-300"
                    : "text-zinc-600",
                ].join(" ")}
              >
                {option.description}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-sm leading-6 text-zinc-500">
        Your initial role determines which Takineo
        workspace and onboarding flow you receive.
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
        className="w-full rounded-lg bg-zinc-950 px-4 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? "Creating your workspace..."
          : "Continue"}
      </button>
    </div>
  );
}