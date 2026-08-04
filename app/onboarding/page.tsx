import { redirect } from "next/navigation";

import { RoleSelectionForm } from "@/components/onboarding/RoleSelectionForm";
import { getUserAccessContext } from "@/lib/auth/access";
import { getCurrentSession } from "@/lib/auth/session";
import { getRoleHome } from "@/lib/domain/user-role";

export default async function OnboardingPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const access = await getUserAccessContext(
    session.user.id,
  );

  if (!access) {
    redirect("/sign-in");
  }

  if (access.role) {
    redirect(getRoleHome(access.role));
  }

  if (access.onboardingCompletedAt) {
    throw new Error(
      "Onboarding is marked as completed, but the user has no role.",
    );
  }

  if (
    access.studentProfile !== null ||
    access.teacherProfile !== null
  ) {
    throw new Error(
      "The user has a profile but no assigned role.",
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <section className="w-full max-w-3xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="text-sm font-medium text-zinc-500">
          Takineo onboarding
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
          How will you use Takineo?
        </h1>

        <p className="mt-3 max-w-2xl leading-7 text-zinc-600">
          Choose the workspace that matches your role.
          This selection creates your initial Takineo
          profile.
        </p>

        <div className="mt-8">
          <RoleSelectionForm />
        </div>
      </section>
    </main>
  );
}