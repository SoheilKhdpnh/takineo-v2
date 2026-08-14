import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { AdminModerationIndex } from "@/components/admin/AdminModerationIndex";
import { requireAppLocale } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";
import { requireAdminPageAccess } from "@/lib/auth/admin-page-guard";
import { listModeratableTeachers } from "@/lib/services/admin-moderation.service";
import { adminModerationListQuerySchema } from "@/lib/validations/admin-moderation";

export const dynamic = "force-dynamic";

interface AdminTeachersPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    status?: string | string[];
    cursor?: string | string[];
  }>;
}

const canonicalModerationHref = "/admin/teachers?status=APPROVED";

export default async function AdminTeachersPage({
  params,
  searchParams,
}: AdminTeachersPageProps) {
  const [{ locale: requestedLocale }, query] = await Promise.all([
    params,
    searchParams,
  ]);

  const locale = requireAppLocale(requestedLocale);
  setRequestLocale(locale);

  const { session, admin } = await requireAdminPageAccess(locale);

  if (!admin.capabilities.moderateTeachers) {
    redirect({
      href: "/admin",
      locale,
    });

    return null;
  }

  if (
    typeof query.status !== "string" ||
    Array.isArray(query.status) ||
    Array.isArray(query.cursor)
  ) {
    redirect({
      href: canonicalModerationHref,
      locale,
    });

    return null;
  }

  const parsedQuery = adminModerationListQuerySchema.safeParse({
    status: query.status,
    cursor: typeof query.cursor === "string" ? query.cursor : undefined,
    limit: 20,
  });

  if (!parsedQuery.success) {
    redirect({
      href: canonicalModerationHref,
      locale,
    });

    return null;
  }

  const result = await listModeratableTeachers(
    session.user.id,
    parsedQuery.data,
  );
  const t = await getTranslations({
    locale,
    namespace: "AdminModerationIndex",
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
    <section aria-labelledby="admin-moderation-title">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-zinc-500">
            {t("eyebrow")}
          </p>
          <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 shadow-sm">
            {t("superAdminOnly")}
          </span>
        </div>

        <h1
          id="admin-moderation-title"
          className="mt-3 text-4xl font-semibold text-zinc-950 sm:text-5xl lg:text-[3.5rem]"
        >
          {t("title")}
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg sm:leading-8">
          {t("description")}
        </p>
      </div>

      <div className="mt-9">
        <AdminModerationIndex
          teachers={result.teachers.map((teacher) => ({
            ...teacher,
            applicationStatus: parsedQuery.data.status,
          }))}
          status={parsedQuery.data.status}
          nextCursor={result.nextCursor}
          formatDate={(value) => dateFormatter.format(value)}
          copy={{
            approvedTab: t("approvedTab"),
            suspendedTab: t("suspendedTab"),
            emptyApprovedTitle: t("emptyApprovedTitle"),
            emptyApprovedDescription: t("emptyApprovedDescription"),
            emptySuspendedTitle: t("emptySuspendedTitle"),
            emptySuspendedDescription: t("emptySuspendedDescription"),
            approvedStatus: t("approvedStatus"),
            suspendedStatus: t("suspendedStatus"),
            headlineLabel: t("headlineLabel"),
            accountLabel: t("accountLabel"),
            reviewedLabel: t("reviewedLabel"),
            reviewCycleLabel: t("reviewCycleLabel"),
            updatedLabel: t("updatedLabel"),
            noHeadline: t("noHeadline"),
            noReviewDate: t("noReviewDate"),
            accountActive: t("accountActive"),
            accountSuspended: t("accountSuspended"),
            accountDisabled: t("accountDisabled"),
            openTeacher: t("openTeacher"),
            nextPage: t("nextPage"),
            endOfList: t("endOfList"),
          }}
        />
      </div>
    </section>
  );
}
