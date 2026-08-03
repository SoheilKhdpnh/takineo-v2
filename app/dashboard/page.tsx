import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { auth } from "@/lib/auth/auth";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-12">
      <section className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">
              Takineo
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
              Authentication works
            </h1>

            <p className="mt-3 text-zinc-600">
              You are signed in as {session.user.name}.
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              {session.user.email}
            </p>
          </div>

          <SignOutButton />
        </div>

        <div className="mt-8 rounded-xl bg-zinc-100 p-5">
          <h2 className="font-medium text-zinc-950">
            Next milestone
          </h2>

          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Student and teacher role selection will be added
            after the authentication foundation is verified.
          </p>
        </div>
      </section>
    </main>
  );
}