import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <section className="w-full max-w-3xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="text-sm font-medium text-zinc-500">
          Takineo
        </p>

        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
          Focused speaking practice with human teachers and
          AI-assisted feedback.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600">
          Takineo is being built around focused 15-minute
          English speaking sessions.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="rounded-lg bg-zinc-950 px-5 py-3 text-center font-medium text-white transition hover:bg-zinc-800"
          >
            Create account
          </Link>

          <Link
            href="/sign-in"
            className="rounded-lg border border-zinc-300 px-5 py-3 text-center font-medium text-zinc-950 transition hover:bg-zinc-100"
          >
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}