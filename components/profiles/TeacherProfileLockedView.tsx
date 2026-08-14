interface TeacherProfileLockedViewProps {
  eyebrow: string;
  title: string;
  statusLabel: string;
  description: string;
  snapshotLabel: string;
  footnote: string;
  fields: Array<{
    label: string;
    value: string;
    multiline?: boolean;
    dir?: "ltr" | "rtl";
  }>;
}

export function TeacherProfileLockedView({
  eyebrow,
  title,
  statusLabel,
  description,
  snapshotLabel,
  footnote,
  fields,
}: TeacherProfileLockedViewProps) {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-12">
      <section
        aria-labelledby="teacher-profile-lock-title"
        className="mx-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm"
      >
        <div className="border-b border-zinc-200 bg-zinc-950 px-8 py-8 text-white sm:px-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm font-medium text-zinc-400">
              {eyebrow}
            </p>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-zinc-100">
              {statusLabel}
            </span>
          </div>

          <h1
            id="teacher-profile-lock-title"
            className="mt-4 text-3xl font-semibold tracking-tight"
          >
            {title}
          </h1>

          <p className="mt-3 max-w-xl leading-7 text-zinc-300">
            {description}
          </p>
        </div>

        <div className="px-8 py-8 sm:px-12 sm:py-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {snapshotLabel}
          </h2>

          <dl className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200">
            {fields.map((field) => (
              <div
                key={field.label}
                className="grid gap-2 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6"
              >
                <dt className="text-sm font-medium text-zinc-500">
                  {field.label}
                </dt>
                <dd
                  dir={field.dir}
                  className={
                    field.multiline
                      ? "whitespace-pre-wrap text-sm leading-7 text-zinc-900"
                      : "text-sm font-medium text-zinc-900"
                  }
                >
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 text-sm leading-6 text-zinc-500">
            {footnote}
          </p>
        </div>
      </section>
    </main>
  );
}
