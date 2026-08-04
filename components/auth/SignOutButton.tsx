"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth/auth-client";

export function SignOutButton() {
  const router = useRouter();
<<<<<<< HEAD

  const [isSubmitting, setIsSubmitting] =
    useState(false);
=======
  const [isSubmitting, setIsSubmitting] = useState(false);
>>>>>>> origin/main

  async function handleSignOut() {
    setIsSubmitting(true);

<<<<<<< HEAD
    const result = await authClient.signOut();

    if (result.error) {
      setIsSubmitting(false);
      return;
    }
=======
    await authClient.signOut();
>>>>>>> origin/main

    router.push("/sign-in");
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={isSubmitting}
      onClick={handleSignOut}
      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
<<<<<<< HEAD
      {isSubmitting
        ? "Signing out..."
        : "Sign out"}
=======
      {isSubmitting ? "Signing out..." : "Sign out"}
>>>>>>> origin/main
    </button>
  );
}