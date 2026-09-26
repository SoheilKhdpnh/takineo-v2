import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";

interface TeacherProfileLockedViewProps {
  eyebrow: string;
  title: string;
  statusLabel: string;
  description: string;
  snapshotLabel: string;
  footnote: string;
  previewTitle?: string;
  displayName?: string;
  image?: string | null;
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
  previewTitle,
  displayName,
  image = null,
  fields,
}: TeacherProfileLockedViewProps) {
  const headline = fields[0]?.value ?? "";
  const bio = fields[1]?.value ?? "";

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="rounded-lg border border-line bg-surface p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm font-medium text-primary">{eyebrow}</p>
            <Badge tone="mint">{statusLabel}</Badge>
          </div>
          <h1
            id="teacher-profile-lock-title"
            className="mt-4 text-3xl tracking-tight text-ink sm:text-4xl"
          >
            {title}
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-ink-muted">{description}</p>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
          <section
            aria-labelledby="teacher-profile-lock-title"
            className="rounded-lg border border-line bg-surface p-5 sm:p-8"
          >
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-ink-muted">
              {snapshotLabel}
            </h2>
            <dl className="mt-6 divide-y divide-line border-y border-line">
              {fields.map((field) => (
                <div
                  key={field.label}
                  className="grid gap-2 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6"
                >
                  <dt className="text-sm font-medium text-ink-muted">{field.label}</dt>
                  <dd
                    dir={field.dir}
                    className={
                      field.multiline
                        ? "whitespace-pre-wrap text-sm leading-7 text-ink"
                        : "text-sm font-medium text-ink"
                    }
                  >
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-sm leading-6 text-ink-muted">{footnote}</p>
          </section>

          {previewTitle && displayName ? (
            <aside className="rounded-lg border border-line bg-surface p-5 xl:sticky xl:top-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                {previewTitle}
              </p>
              <div className="mt-4 flex items-start gap-3">
                <Avatar name={displayName} image={image} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{displayName}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">{headline}</p>
                </div>
              </div>
              <p className="mt-4 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-ink">
                {bio}
              </p>
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  );
}
