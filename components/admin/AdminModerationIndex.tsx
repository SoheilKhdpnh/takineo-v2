import { Link } from "@/i18n/navigation";

type ModerationStatus = "APPROVED" | "SUSPENDED";
type AccountStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";

export interface AdminModerationTeacher {
  id: string;
  headline: string | null;
  applicationStatus: ModerationStatus;
  applicationReviewedAt: Date | null;
  reviewCycle: number;
  updatedAt: Date;
  user: {
    name: string;
    email: string;
    accountStatus: AccountStatus;
  };
}

interface AdminModerationIndexCopy {
  approvedTab: string;
  suspendedTab: string;
  emptyApprovedTitle: string;
  emptyApprovedDescription: string;
  emptySuspendedTitle: string;
  emptySuspendedDescription: string;
  approvedStatus: string;
  suspendedStatus: string;
  headlineLabel: string;
  accountLabel: string;
  reviewedLabel: string;
  reviewCycleLabel: string;
  updatedLabel: string;
  noHeadline: string;
  noReviewDate: string;
  accountActive: string;
  accountSuspended: string;
  accountDisabled: string;
  openTeacher: string;
  nextPage: string;
  endOfList: string;
}

interface AdminModerationIndexProps {
  teachers: AdminModerationTeacher[];
  status: ModerationStatus;
  nextCursor: string | null;
  formatDate: (value: Date) => string;
  copy: AdminModerationIndexCopy;
}

const accountCopyKey = {
  ACTIVE: "accountActive",
  SUSPENDED: "accountSuspended",
  DISABLED: "accountDisabled",
} as const satisfies Record<AccountStatus, keyof AdminModerationIndexCopy>;

function filterClass(active: boolean) {
  return `inline-flex min-h-11 items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 ${
    active
      ? "border-zinc-950 bg-zinc-950 text-white shadow-sm"
      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950"
  }`;
}

export function AdminModerationIndex({
  teachers,
  status,
  nextCursor,
  formatDate,
  copy,
}: AdminModerationIndexProps) {
  const approved = status === "APPROVED";

  return (
    <div>
      <nav aria-label={`${copy.approvedTab} / ${copy.suspendedTab}`}>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/teachers?status=APPROVED"
            aria-current={approved ? "page" : undefined}
            className={filterClass(approved)}
          >
            {copy.approvedTab}
          </Link>
          <Link
            href="/admin/teachers?status=SUSPENDED"
            aria-current={!approved ? "page" : undefined}
            className={filterClass(!approved)}
          >
            {copy.suspendedTab}
          </Link>
        </div>
      </nav>

      {teachers.length === 0 ? (
        <section
          aria-labelledby="admin-moderation-empty-title"
          className="mt-7 rounded-[2rem] border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10 sm:py-16"
        >
          <div
            aria-hidden="true"
            className="mx-auto grid size-12 place-items-center rounded-2xl bg-zinc-100"
          >
            <span className="size-2.5 rounded-full bg-zinc-400" />
          </div>
          <h2
            id="admin-moderation-empty-title"
            className="mt-5 text-xl font-semibold text-zinc-950"
          >
            {approved ? copy.emptyApprovedTitle : copy.emptySuspendedTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-zinc-600">
            {approved
              ? copy.emptyApprovedDescription
              : copy.emptySuspendedDescription}
          </p>
        </section>
      ) : (
        <ol className="mt-7 space-y-4">
          {teachers.map((teacher) => (
            <li key={teacher.id}>
              <article className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 xl:max-w-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-zinc-950 sm:text-xl">
                        {teacher.user.name}
                      </h2>
                      <span
                        className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${
                          teacher.applicationStatus === "APPROVED"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                        }`}
                      >
                        {teacher.applicationStatus === "APPROVED"
                          ? copy.approvedStatus
                          : copy.suspendedStatus}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-sm text-zinc-500">
                      {teacher.user.email}
                    </p>
                    <p className="mt-4 text-sm leading-7 text-zinc-700">
                      {teacher.headline || copy.noHeadline}
                    </p>
                    <Link
                      href={`/admin/teacher-applications/${teacher.id}`}
                      className="mt-5 inline-flex min-h-10 items-center rounded-xl text-sm font-semibold text-zinc-700 transition hover:text-zinc-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                    >
                      {copy.openTeacher}
                    </Link>
                  </div>

                  <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:min-w-[38rem] xl:grid-cols-3">
                    <div>
                      <dt className="text-xs font-semibold text-zinc-500">
                        {copy.accountLabel}
                      </dt>
                      <dd className="mt-1.5 font-medium text-zinc-900">
                        {copy[accountCopyKey[teacher.user.accountStatus]]}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-zinc-500">
                        {copy.reviewedLabel}
                      </dt>
                      <dd className="mt-1.5 font-medium text-zinc-900">
                        {teacher.applicationReviewedAt
                          ? formatDate(teacher.applicationReviewedAt)
                          : copy.noReviewDate}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-zinc-500">
                        {copy.reviewCycleLabel}
                      </dt>
                      <dd className="mt-1.5 font-medium tabular-nums text-zinc-900">
                        {teacher.reviewCycle}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-zinc-500">
                        {copy.updatedLabel}
                      </dt>
                      <dd className="mt-1.5 font-medium text-zinc-900">
                        {formatDate(teacher.updatedAt)}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold text-zinc-500">
                        {copy.headlineLabel}
                      </dt>
                      <dd className="mt-1.5 break-words font-medium text-zinc-900">
                        {teacher.headline || copy.noHeadline}
                      </dd>
                    </div>
                  </dl>
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}

      {teachers.length > 0 ? (
        <div className="mt-7 flex justify-end">
          {nextCursor ? (
            <Link
              href={`/admin/teachers?status=${status}&cursor=${encodeURIComponent(nextCursor)}`}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              {copy.nextPage}
            </Link>
          ) : (
            <p className="text-sm font-medium text-zinc-500">
              {copy.endOfList}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
