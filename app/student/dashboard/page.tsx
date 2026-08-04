import { SignOutButton } from "@/components/auth/SignOutButton";

export default function StudentDashboardPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-12">
      <section className="mx-auto max-w-4xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">
              Student workspace
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
              Welcome to Takineo
            </h1>

            <p className="mt-3 max-w-xl leading-7 text-zinc-600">
              Your student profile is ready. Teacher
              discovery and session booking will be added
              in upcoming milestones.
            </p>
          </div>

          <SignOutButton />
        </div>
      </section>
    </main>
  );
}