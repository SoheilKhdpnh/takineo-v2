import { notFound } from "next/navigation";
import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { AdminReviewDetail } from "@/components/admin/AdminReviewDetail";
import { requireAppLocale } from "@/i18n/locale";
import { requireAdminPageAccess } from "@/lib/auth/admin-page-guard";
import { parseAparatVideoUrl, APARAT_SPOKEN_PHRASE } from "@/lib/domain/aparat-video";
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

  const { session, admin } = await requireAdminPageAccess(locale);
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

  const video = application.introVideo;
  const parsedVideo = video?.aparatUrl
    ? parseAparatVideoUrl(video.aparatUrl)
    : null;
  const snapshotAligned = Boolean(
    application.applicationSubmittedAt &&
      application.reviewCycle > 0 &&
      application.submittedProfileRevision !== null &&
      application.submittedProfileRevision === application.profileRevision &&
      application.submittedVideoId &&
      application.submittedVideoRevision !== null &&
      application.submittedAparatHash &&
      application.videoVerificationCode &&
      video &&
      video.provider === "aparat" &&
      video.id === application.submittedVideoId &&
      video.revision === application.submittedVideoRevision &&
      video.aparatHash === application.submittedAparatHash &&
      parsedVideo?.hash === video.aparatHash,
  );
  const decisionGuard =
    snapshotAligned &&
    application.applicationStatus === "PENDING_REVIEW" &&
    application.submittedProfileRevision !== null &&
    application.submittedVideoId &&
    application.submittedVideoRevision !== null &&
    video &&
    ["READY_FOR_REVIEW", "APPROVED"].includes(video.status)
      ? {
          reviewCycle: application.reviewCycle,
          profileRevision: application.submittedProfileRevision,
          videoId: application.submittedVideoId,
          videoRevision: application.submittedVideoRevision,
        }
      : null;
  const canApprove = Boolean(
    decisionGuard &&
      application.user.accountStatus === "ACTIVE" &&
      application.profileCompletedAt,
  );
  const moderationGuard =
    admin.capabilities.moderateTeachers &&
    video?.status === "APPROVED" &&
    video.aparatHash &&
    (application.applicationStatus === "APPROVED" ||
      (application.applicationStatus === "SUSPENDED" &&
        application.user.accountStatus === "ACTIVE"))
      ? {
          action:
            application.applicationStatus === "APPROVED"
              ? ("SUSPEND" as const)
              : ("REINSTATE" as const),
          reviewCycle: application.reviewCycle,
        }
      : null;

  return (
    <AdminReviewDetail
      decisionGuard={decisionGuard}
      canApprove={canApprove}
      canModerateTeachers={admin.capabilities.moderateTeachers}
      moderationGuard={moderationGuard}
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
        videoVerificationCode: application.videoVerificationCode,
        user: {
          name: application.user.name,
          email: application.user.email,
          accountStatus: application.user.accountStatus,
        },
        introVideo: video
          ? {
              revision: video.revision,
              status: video.status,
              aparatUrl: parsedVideo?.canonicalUrl ?? video.aparatUrl,
              embedUrl: parsedVideo?.embedUrl ?? null,
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
        videoUrlLabel: t("videoUrlLabel"),
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
        playbackDescription: t("playbackDescription"),
        playbackCodeLabel: t("playbackCodeLabel"),
        playbackSpokenPhraseLabel: t("playbackSpokenPhraseLabel"),
        playbackSpokenPhrase: APARAT_SPOKEN_PHRASE,
        playbackUnavailableState: t("playbackUnavailableState"),
        playbackPublicHostNote: t("playbackPublicHostNote"),
        playbackPlayerTitle: t("playbackPlayerTitle"),
        decisionHeading: t("decisionHeading"),
        decisionDescription: t("decisionDescription"),
        decisionUnavailable: t("decisionUnavailable"),
        approveAction: t("approveAction"),
        rejectAction: t("rejectAction"),
        approveHeading: t("approveHeading"),
        approveDescription: t("approveDescription"),
        approveUnavailable: t("approveUnavailable"),
        approveConfirm: t("approveConfirm"),
        spokenCodeLabel: t("spokenCodeLabel"),
        spokenCodeRequired: t("spokenCodeRequired"),
        approveVisibilityNote: t("approveVisibilityNote"),
        rejectHeading: t("rejectHeading"),
        rejectDescription: t("rejectDescription"),
        rejectTargetLabel: t("rejectTargetLabel"),
        rejectProfile: t("rejectProfile"),
        rejectVideo: t("rejectVideo"),
        rejectBoth: t("rejectBoth"),
        profileReasonLabel: t("profileReasonLabel"),
        profileReasonPlaceholder: t("profileReasonPlaceholder"),
        videoReasonLabel: t("videoReasonLabel"),
        videoReasonPlaceholder: t("videoReasonPlaceholder"),
        rejectionReasonHint: t("rejectionReasonHint"),
        rejectionTargetRequired: t("rejectionTargetRequired"),
        profileReasonRequired: t("profileReasonRequired"),
        videoReasonRequired: t("videoReasonRequired"),
        submitRejection: t("submitRejection"),
        cancelDecision: t("cancelDecision"),
        decisionSubmitting: t("decisionSubmitting"),
        approveSuccess: t("approveSuccess"),
        rejectSuccess: t("rejectSuccess"),
        decisionUnauthorized: t("decisionUnauthorized"),
        decisionForbidden: t("decisionForbidden"),
        decisionConflict: t("decisionConflict"),
        decisionInvalidRequest: t("decisionInvalidRequest"),
        decisionGenericError: t("decisionGenericError"),
        decisionReload: t("decisionReload"),
        moderationHeading: t("moderationHeading"),
        moderationDescription: t("moderationDescription"),
        moderationRestricted: t("moderationRestricted"),
        moderationUnavailable: t("moderationUnavailable"),
        suspendAction: t("suspendAction"),
        reinstateAction: t("reinstateAction"),
        suspendHeading: t("suspendHeading"),
        suspendDescription: t("suspendDescription"),
        reinstateHeading: t("reinstateHeading"),
        reinstateDescription: t("reinstateDescription"),
        moderationReasonLabel: t("moderationReasonLabel"),
        suspendReasonPlaceholder: t("suspendReasonPlaceholder"),
        reinstateReasonPlaceholder: t("reinstateReasonPlaceholder"),
        moderationReasonHint: t("moderationReasonHint"),
        moderationReasonRequired: t("moderationReasonRequired"),
        suspendConfirm: t("suspendConfirm"),
        reinstateConfirm: t("reinstateConfirm"),
        moderationCancel: t("moderationCancel"),
        moderationSubmitting: t("moderationSubmitting"),
        suspendSuccess: t("suspendSuccess"),
        reinstateSuccess: t("reinstateSuccess"),
        moderationUnauthorized: t("moderationUnauthorized"),
        moderationForbidden: t("moderationForbidden"),
        moderationConflict: t("moderationConflict"),
        moderationInvalidRequest: t("moderationInvalidRequest"),
        moderationGenericError: t("moderationGenericError"),
        moderationReload: t("moderationReload"),
      }}
      formatDate={(value) => dateFormatter.format(value)}
    />
  );
}
