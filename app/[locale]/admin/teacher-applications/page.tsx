import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { AdminReviewQueue } from "@/components/admin/AdminReviewQueue";
import { requireAppLocale } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";
import { requireAdminPageAccess } from "@/lib/auth/admin-page-guard";
import { listPendingTeacherApplications } from "@/lib/services/admin-review.service";
import { adminQueueQuerySchema } from "@/lib/validations/admin-review";

export const dynamic = "force-dynamic";

interface AdminTeacherApplicationsPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    cursor?: string | string[];
  }>;
}

export default async function AdminTeacherApplicationsPage({
  params,
  searchParams,
}: AdminTeacherApplicationsPageProps) {
  const [{ locale: requestedLocale }, query] = await Promise.all([
    params,
    searchParams,
  ]);

  const locale = requireAppLocale(requestedLocale);
  setRequestLocale(locale);

  const { session } = await requireAdminPageAccess(locale);

  const parsedQuery = adminQueueQuerySchema.safeParse({
    cursor: typeof query.cursor === "string" ? query.cursor : undefined,
    limit: 20,
  });

  if (!parsedQuery.success || Array.isArray(query.cursor)) {
    redirect({
      href: "/admin/teacher-applications",
      locale,
    });

    return null;
  }

  const queue = await listPendingTeacherApplications(
    session.user.id,
    parsedQuery.data,
  );
  const t = await getTranslations({
    locale,
    namespace: "AdminReviewQueue",
  });

  const dateFormatter = new Intl.DateTimeFormat(
    locale === "fa" ? "fa-IR-u-ca-persian" : "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Tehran",
    },
  );

  return (
    <section aria-labelledby="admin-review-queue-title">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-zinc-500">
            {t("eyebrow")}
          </p>
          <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 shadow-sm">
            {t("oldestFirst")}
          </span>
        </div>

        <h1
          id="admin-review-queue-title"
          className="mt-3 text-4xl font-semibold text-zinc-950 sm:text-5xl lg:text-[3.5rem]"
        >
          {t("title")}
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg sm:leading-8">
          {t("description")}
        </p>
      </div>

      <div className="mt-9">
        <AdminReviewQueue
          applications={queue.applications}
          nextCursor={queue.nextCursor}
          formatSubmittedAt={(value) => dateFormatter.format(value)}
          copy={{
            emptyTitle: t("emptyTitle"),
            emptyDescription: t("emptyDescription"),
            submittedLabel: t("submittedLabel"),
            reviewCycleLabel: t("reviewCycleLabel"),
            videoLabel: t("videoLabel"),
            durationLabel: t("durationLabel"),
            accountLabel: t("accountLabel"),
            snapshotLabel: t("snapshotLabel"),
            snapshotReady: t("snapshotReady"),
            snapshotIncomplete: t("snapshotIncomplete"),
            noSubmissionDate: t("noSubmissionDate"),
            noVideo: t("noVideo"),
            noDuration: t("noDuration"),
            accountActive: t("accountActive"),
            accountSuspended: t("accountSuspended"),
            accountDisabled: t("accountDisabled"),
            videoUploadPending: t("videoUploadPending"),
            videoProcessing: t("videoProcessing"),
            videoReadyForReview: t("videoReadyForReview"),
            videoApproved: t("videoApproved"),
            videoRejected: t("videoRejected"),
            videoFailed: t("videoFailed"),
            nextPage: t("nextPage"),
            endOfQueue: t("endOfQueue"),
            openApplication: t("openApplication"),
          }}
        />
      </div>
    </section>
  );
}
