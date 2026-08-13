import { notFound } from "next/navigation";
import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { AdminReviewDetail } from "@/components/admin/AdminReviewDetail";
import { requireAppLocale } from "@/i18n/locale";
import { requireAdminPageAccess } from "@/lib/auth/admin-page-guard";
import { AdminTargetNotFoundError } from "@/lib/errors/admin-errors";
import { getAdminTeacherApplication } from "@/lib/services/admin-review.service";
import { fromTimezoneEnum } from "@/lib/timezone";
import { adminApplicationIdSchema } from "@/lib/validations/admin-review";

export const dynamic = "force-dynamic";

interface AdminTeacherApplicationDetailPageProps {
  params: Promise<{
    locale: string;
    applicationId: string;
  }>;
}

const nativeLanguageKey = {
  fa: "languages.fa",
  en: "languages.en",
  ar: "languages.ar",
  tr: "languages.tr",
  ku: "languages.ku",
} as const;

export default async function AdminTeacherApplicationDetailPage({
  params,
}: AdminTeacherApplicationDetailPageProps) {
  const { locale: requestedLocale, applicationId } = await params;
  const locale = requireAppLocale(requestedLocale);
  setRequestLocale(locale);

  const { session } = await requireAdminPageAccess(locale);
  const parsedApplicationId = adminApplicationIdSchema.safeParse(applicationId);

  if (!parsedApplicationId.success) {
    notFound();
  }

  let application: Awaited<ReturnType<typeof getAdminTeacherApplication>>;

  try {
    application = await getAdminTeacherApplication(
      session.user.id,
      parsedApplicationId.data,
    );
  } catch (error) {
    if (error instanceof AdminTargetNotFoundError) {
      notFound();
    }

    throw error;
  }

  const [t, common] = await Promise.all([
    getTranslations({ locale, namespace: "AdminReviewDetail" }),
    getTranslations({ locale, namespace: "ProfileCommon" }),
  ]);

  const dateFormatter = new Intl.DateTimeFormat(
    locale === "fa" ? "fa-IR-u-ca-persian" : "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Tehran",
    },
  );

  const numberFormatter = new Intl.NumberFormat(
    locale === "fa" ? "fa-IR" : "en-US",
  );
  const video = application.introVideo;
  const snapshotAligned = Boolean(
    application.applicationSubmittedAt &&
      application.reviewCycle > 0 &&
      application.submittedProfileRevision !== null &&
      application.submittedProfileRevision === application.profileRevision &&
      application.submittedVideoId &&
      application.submittedVideoRevision !== null &&
      application.submittedVideoUploadId &&
      application.submittedVideoAssetId &&
      video &&
      video.provider === "mux" &&
      video.id === application.submittedVideoId &&
      video.revision === application.submittedVideoRevision &&
      video.uploadId === application.submittedVideoUploadId &&
      video.assetId === application.submittedVideoAssetId,
  );

  return (
    <AdminReviewDetail
      application={{
        id: application.id,
        headline: application.headline,
        bio: application.bio,
        experienceYears: application.experienceYears,
        nativeLanguageLabel: common(
          nativeLanguageKey[application.nativeLanguage],
        ),
        teachingLanguageLabel:
          application.teachingLanguage === "en"
            ? common("languages.en")
            : application.teachingLanguage,
        timezoneLabel: fromTimezoneEnum(application.timezone),
        profileCompletedAt: application.profileCompletedAt,
        profileRevision: application.profileRevision,
        applicationStatus: application.applicationStatus,
        applicationSubmittedAt: application.applicationSubmittedAt,
        applicationReviewedAt: application.applicationReviewedAt,
        applicationReviewNote: application.applicationReviewNote,
        reviewCycle: application.reviewCycle,
        submittedProfileRevision: application.submittedProfileRevision,
        submittedVideoRevision: application.submittedVideoRevision,
        snapshotAligned,
        user: {
          name: application.user.name,
          email: application.user.email,
          accountStatus: application.user.accountStatus,
        },
        introVideo: video
          ? {
              revision: video.revision,
              status: video.status,
              durationSeconds: video.durationSeconds,
              rejectionReason: video.rejectionReason,
              submittedAt: video.submittedAt,
              reviewedAt: video.reviewedAt,
            }
          : null,
      }}
      copy={{
        backToQueue: t("backToQueue"),
        eyebrow: t("eyebrow"),
        title: t("title", { name: application.user.name }),
        description: t("description"),
        applicationIdLabel: t("applicationIdLabel"),
        snapshotAligned: t("snapshotAligned"),
        snapshotChanged: t("snapshotChanged"),
        profileHeading: t("profileHeading"),
        identityHeading: t("identityHeading"),
        reviewSnapshotHeading: t("reviewSnapshotHeading"),
        videoHeading: t("videoHeading"),
        headlineLabel: t("headlineLabel"),
        bioLabel: t("bioLabel"),
        experienceLabel: t("experienceLabel"),
        nativeLanguageLabel: t("nativeLanguageLabel"),
        teachingLanguageLabel: t("teachingLanguageLabel"),
        timezoneLabel: t("timezoneLabel"),
        profileCompletedLabel: t("profileCompletedLabel"),
        profileRevisionLabel: t("profileRevisionLabel"),
        applicantNameLabel: t("applicantNameLabel"),
        applicantEmailLabel: t("applicantEmailLabel"),
        accountStatusLabel: t("accountStatusLabel"),
        applicationStatusLabel: t("applicationStatusLabel"),
        submittedLabel: t("submittedLabel"),
        reviewedLabel: t("reviewedLabel"),
        reviewCycleLabel: t("reviewCycleLabel"),
        submittedProfileRevisionLabel: t("submittedProfileRevisionLabel"),
        submittedVideoRevisionLabel: t("submittedVideoRevisionLabel"),
        videoStatusLabel: t("videoStatusLabel"),
        videoDurationLabel: t("videoDurationLabel"),
        videoRevisionLabel: t("videoRevisionLabel"),
        videoSubmittedLabel: t("videoSubmittedLabel"),
        videoReviewedLabel: t("videoReviewedLabel"),
        applicationNoteLabel: t("applicationNoteLabel"),
        videoRejectionReasonLabel: t("videoRejectionReasonLabel"),
        noValue: t("noValue"),
        years: t("years"),
        accountActive: t("accountActive"),
        accountSuspended: t("accountSuspended"),
        accountDisabled: t("accountDisabled"),
        applicationDraft: t("applicationDraft"),
        applicationPendingReview: t("applicationPendingReview"),
        applicationApproved: t("applicationApproved"),
        applicationRejected: t("applicationRejected"),
        applicationSuspended: t("applicationSuspended"),
        videoUploadPending: t("videoUploadPending"),
        videoProcessing: t("videoProcessing"),
        videoReadyForReview: t("videoReadyForReview"),
        videoApproved: t("videoApproved"),
        videoRejected: t("videoRejected"),
        videoFailed: t("videoFailed"),
        noVideo: t("noVideo"),
        playbackHeading: t("playbackHeading"),
        playbackDeferred: t("playbackDeferred"),
        actionsDeferred: t("actionsDeferred"),
      }}
      formatDate={(value) => dateFormatter.format(value)}
      formatDuration={(seconds) =>
        seconds === null || !Number.isFinite(seconds) || seconds < 0
          ? t("noValue")
          : t("durationValue", {
              seconds: numberFormatter.format(Math.round(seconds)),
            })
      }
    />
  );
}
