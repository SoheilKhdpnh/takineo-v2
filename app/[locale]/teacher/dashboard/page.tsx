import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { TeacherApplicationSubmit } from "@/components/profiles/TeacherApplicationSubmit";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { UpcomingSessionsPanel } from "@/components/sessions/UpcomingSessionsPanel";
import { requireAppLocale } from "@/i18n/locale";
import {
  Link,
  redirect,
} from "@/i18n/navigation";
import { requireRolePage } from "@/lib/auth/page-guards";
import { getTeacherProfileForUser } from "@/lib/services/teacher-profile.service";

interface TeacherDashboardPageProps {
  params: Promise<{
    locale: string;
  }>;
}

const applicationStatusTranslationKeys = {
  DRAFT: "statusDraft",
  PENDING_REVIEW: "statusPendingReview",
  APPROVED: "statusApproved",
  REJECTED: "statusRejected",
  SUSPENDED: "statusSuspended",
} as const;

const videoStatusTranslationKeys = {
  UPLOAD_PENDING: "videoMissing",
  PROCESSING: "videoProcessing",
  READY_FOR_REVIEW: "videoReview",
  APPROVED: "videoApproved",
  REJECTED: "videoRejected",
  FAILED: "videoFailed",
} as const;

export default async function TeacherDashboardPage({
  params,
}: TeacherDashboardPageProps) {
  const { locale: requestedLocale } =
    await params;

  const locale = requireAppLocale(
    requestedLocale,
  );

  setRequestLocale(locale);

  const { session } =
    await requireRolePage(
      "TEACHER",
      locale,
    );

  const teacherProfile =
    await getTeacherProfileForUser(
      session.user.id,
    );

  if (!teacherProfile.profileCompletedAt) {
    redirect({
      href: "/teacher/profile",
      locale,
    });
    return;
  }

  const t = await getTranslations({
    locale,
    namespace: "TeacherDashboard",
  });

  const applicationStatus =
    teacherProfile.applicationStatus;

  const introVideo =
    teacherProfile.introVideo;

  const videoMessage = introVideo
    ? t(
        videoStatusTranslationKeys[
          introVideo.status
        ],
      )
    : t("videoMissing");

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-12 sm:px-6">
      <section className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-6 rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-zinc-500">
              {t("eyebrow")}
            </p>

            <h1 className="mt-3 text-4xl font-semibold text-zinc-950 sm:text-5xl">
              {t("title")}
            </h1>

            <p className="mt-4 max-w-xl text-base leading-8 text-zinc-600">
              {t("description")}
            </p>
          </div>

          <SignOutButton />
        </header>

        <div className="mt-6">
          <UpcomingSessionsPanel
            viewerRole="TEACHER"
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
            <p className="text-sm font-semibold text-zinc-500">
              {t("applicationStatus")}
            </p>

            <p className="mt-3 text-2xl font-semibold text-zinc-950">
              {t(
                applicationStatusTranslationKeys[
                  applicationStatus
                ],
              )}
            </p>

            <h2 className="mt-8 text-xl text-zinc-950">
              {t("applicationHeading")}
            </h2>

            <p className="mt-3 leading-7 text-zinc-600">
              {t("applicationDescription")}
            </p>

            {(
              applicationStatus === "DRAFT" ||
              applicationStatus === "REJECTED"
            ) ? (
              <Link
                href="/teacher/profile"
                className="mt-6 inline-flex rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:border-zinc-950 hover:bg-zinc-50"
              >
                {t("editProfile")}
              </Link>
            ) : null}
          </article>

          <article className="rounded-3xl border border-zinc-200 bg-zinc-950 p-7 text-white shadow-sm">
            <p className="text-sm font-semibold text-zinc-400">
              {t("videoHeading")}
            </p>

            <p className="mt-4 text-lg leading-8 text-zinc-100">
              {videoMessage}
            </p>

            {!introVideo ? (
              <p className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-zinc-300">
                {t("nextStepVideo")}
              </p>
            ) : null}
            {(
              applicationStatus === "DRAFT" ||
              applicationStatus === "REJECTED"
            ) ? (
              <Link
                href="/teacher/video"
                className="mt-6 inline-flex rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                {t("manageVideo")}
              </Link>
            ) : null}
          </article>
        </div>

        {applicationStatus === "APPROVED" ? (
          <aside className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
            {t("approvedNotice")}
          </aside>
        ) : null}
        <div className="mt-6">
          <TeacherApplicationSubmit
            applicationStatus={
              teacherProfile.applicationStatus
            }
            profileCompleted={
              teacherProfile.profileCompletedAt !==
              null
            }
            videoStatus={
              teacherProfile.introVideo?.status ??
              null
            }
            rejectionFeedback={
              applicationStatus === "REJECTED"
                ? teacherProfile.applicationReviewNote
                : null
            }
          />
        </div>
      </section>
    </main>
  );
}