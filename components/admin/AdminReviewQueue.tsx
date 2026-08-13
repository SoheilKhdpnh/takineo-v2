import { Link } from "@/i18n/navigation";

export interface AdminQueueApplication {
  id: string;
  reviewCycle: number;
  submittedProfileRevision: number | null;
  submittedVideoId: string | null;
  submittedVideoRevision: number | null;
  applicationSubmittedAt: Date | null;
  user: {
    name: string;
    email: string;
    accountStatus: "ACTIVE" | "SUSPENDED" | "DISABLED";
  };
  introVideo: null | {
    id: string;
    revision: number;
    status:
      | "UPLOAD_PENDING"
      | "PROCESSING"
      | "READY_FOR_REVIEW"
      | "APPROVED"
      | "REJECTED"
      | "FAILED";
    durationSeconds: number | null;
  };
}

interface AdminReviewQueueCopy {
  emptyTitle: string;
  emptyDescription: string;
  submittedLabel: string;
  reviewCycleLabel: string;
  videoLabel: string;
  durationLabel: string;
  accountLabel: string;
  snapshotLabel: string;
  snapshotReady: string;
  snapshotIncomplete: string;
  noSubmissionDate: string;
  noVideo: string;
  noDuration: string;
  accountActive: string;
  accountSuspended: string;
  accountDisabled: string;
  videoUploadPending: string;
  videoProcessing: string;
  videoReadyForReview: string;
  videoApproved: string;
  videoRejected: string;
  videoFailed: string;
  nextPage: string;
  endOfQueue: string;
  openApplication: string;
}

interface AdminReviewQueueProps {
  applications: AdminQueueApplication[];
  nextCursor: string | null;
  copy: AdminReviewQueueCopy;
  formatSubmittedAt: (value: Date) => string;
}

const accountCopyKey = {
  ACTIVE: "accountActive",
  SUSPENDED: "accountSuspended",
  DISABLED: "accountDisabled",
} as const satisfies Record<
  AdminQueueApplication["user"]["accountStatus"],
  keyof AdminReviewQueueCopy
>;

const videoCopyKey = {
  UPLOAD_PENDING: "videoUploadPending",
  PROCESSING: "videoProcessing",
  READY_FOR_REVIEW: "videoReadyForReview",
  APPROVED: "videoApproved",
  REJECTED: "videoRejected",
  FAILED: "videoFailed",
} as const satisfies Record<
  NonNullable<AdminQueueApplication["introVideo"]>["status"],
  keyof AdminReviewQueueCopy
>;

function formatDuration(seconds: number | null, fallback: string) {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return fallback;
  }

  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function hasCompleteReviewSnapshot(application: AdminQueueApplication) {
  const video = application.introVideo;

  return Boolean(
    application.applicationSubmittedAt &&
      application.reviewCycle > 0 &&
      application.submittedProfileRevision !== null &&
      application.submittedProfileRevision > 0 &&
      application.submittedVideoId &&
      application.submittedVideoRevision !== null &&
      application.submittedVideoRevision > 0 &&
      application.user.accountStatus === "ACTIVE" &&
      video &&
      video.id === application.submittedVideoId &&
      video.revision === application.submittedVideoRevision &&
      ["READY_FOR_REVIEW", "APPROVED"].includes(video.status),
  );
}

export function AdminReviewQueue({
  applications,
  nextCursor,
  copy,
  formatSubmittedAt,
}: AdminReviewQueueProps) {
  if (applications.length === 0) {
    return (
      <section
        aria-labelledby="admin-review-empty-title"
        className="rounded-[2rem] border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10 sm:py-16"
      >
        <div
          aria-hidden="true"
          className="mx-auto grid size-12 place-items-center rounded-2xl bg-zinc-100"
        >
          <span className="size-2.5 rounded-full bg-zinc-400" />
        </div>
        <h2
          id="admin-review-empty-title"
          className="mt-5 text-xl font-semibold text-zinc-950"
        >
          {copy.emptyTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-zinc-600">
          {copy.emptyDescription}
        </p>
      </section>
    );
  }

  return (
    <div>
      <ol className="space-y-4">
        {applications.map((application) => {
          const snapshotReady = hasCompleteReviewSnapshot(application);
          const video = application.introVideo;

          return (
            <li key={application.id}>
              <article className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-zinc-950 sm:text-xl">
                        {application.user.name}
                      </h2>
                      <span
                        className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${
                          snapshotReady
                            ? "border-zinc-200 bg-zinc-50 text-zinc-700"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                        }`}
                      >
                        {snapshotReady
                          ? copy.snapshotReady
                          : copy.snapshotIncomplete}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-sm text-zinc-500">
                      {application.user.email}
                    </p>
                    <Link
                      href={`/admin/teacher-applications/${application.id}`}
                      className="mt-4 inline-flex min-h-10 items-center rounded-xl text-sm font-semibold text-zinc-700 transition hover:text-zinc-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                    >
                      {copy.openApplication}
                    </Link>
                  </div>

                  <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:min-w-[34rem] xl:grid-cols-3">
                    <div>
                      <dt className="text-xs font-semibold text-zinc-500">
                        {copy.submittedLabel}
                      </dt>
                      <dd className="mt-1.5 font-medium text-zinc-900">
                        {application.applicationSubmittedAt
                          ? formatSubmittedAt(application.applicationSubmittedAt)
                          : copy.noSubmissionDate}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-zinc-500">
                        {copy.reviewCycleLabel}
                      </dt>
                      <dd className="mt-1.5 font-medium text-zinc-900">
                        {application.reviewCycle}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-zinc-500">
                        {copy.accountLabel}
                      </dt>
                      <dd className="mt-1.5 font-medium text-zinc-900">
                        {copy[accountCopyKey[application.user.accountStatus]]}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-zinc-500">
                        {copy.videoLabel}
                      </dt>
                      <dd className="mt-1.5 font-medium text-zinc-900">
                        {video ? copy[videoCopyKey[video.status]] : copy.noVideo}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-zinc-500">
                        {copy.durationLabel}
                      </dt>
                      <dd className="mt-1.5 font-medium tabular-nums text-zinc-900">
                        {video
                          ? formatDuration(video.durationSeconds, copy.noDuration)
                          : copy.noDuration}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-zinc-500">
                        {copy.snapshotLabel}
                      </dt>
                      <dd className="mt-1.5 font-mono text-xs text-zinc-600">
                        {application.id}
                      </dd>
                    </div>
                  </dl>
                </div>
              </article>
            </li>
          );
        })}
      </ol>

      <div className="mt-7 flex justify-end">
        {nextCursor ? (
          <Link
            href={`/admin/teacher-applications?cursor=${encodeURIComponent(nextCursor)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
          >
            {copy.nextPage}
          </Link>
        ) : (
          <p className="text-sm font-medium text-zinc-500">
            {copy.endOfQueue}
          </p>
        )}
      </div>
    </div>
  );
}
