import type { ReactNode } from "react";

import {
  AdminReviewDecision,
  type AdminReviewDecisionGuard,
} from "@/components/admin/AdminReviewDecision";
import { AdminReviewPlayback } from "@/components/admin/AdminReviewPlayback";
import {
  AdminTeacherModeration,
  type AdminTeacherModerationGuard,
} from "@/components/admin/AdminTeacherModeration";
import { Link } from "@/i18n/navigation";

export interface AdminReviewDetailApplication {
  id: string;
  headline: string | null;
  bio: string | null;
  experienceYears: number | null;
  nativeLanguageLabel: string;
  teachingLanguageLabel: string;
  timezoneLabel: string;
  profileCompletedAt: Date | null;
  profileRevision: number;
  applicationStatus:
    | "DRAFT"
    | "PENDING_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "SUSPENDED";
  applicationSubmittedAt: Date | null;
  applicationReviewedAt: Date | null;
  applicationReviewNote: string | null;
  reviewCycle: number;
  submittedProfileRevision: number | null;
  submittedVideoRevision: number | null;
  snapshotAligned: boolean;
  user: {
    name: string;
    email: string;
    accountStatus: "ACTIVE" | "SUSPENDED" | "DISABLED";
  };
  introVideo: null | {
    revision: number;
    status:
      | "UPLOAD_PENDING"
      | "PROCESSING"
      | "READY_FOR_REVIEW"
      | "APPROVED"
      | "REJECTED"
      | "FAILED";
    durationSeconds: number | null;
    rejectionReason: string | null;
    submittedAt: Date | null;
    reviewedAt: Date | null;
  };
}

interface AdminReviewDetailCopy {
  backToQueue: string;
  eyebrow: string;
  title: string;
  description: string;
  applicationIdLabel: string;
  snapshotAligned: string;
  snapshotChanged: string;
  profileHeading: string;
  identityHeading: string;
  reviewSnapshotHeading: string;
  videoHeading: string;
  headlineLabel: string;
  bioLabel: string;
  experienceLabel: string;
  nativeLanguageLabel: string;
  teachingLanguageLabel: string;
  timezoneLabel: string;
  profileCompletedLabel: string;
  profileRevisionLabel: string;
  applicantNameLabel: string;
  applicantEmailLabel: string;
  accountStatusLabel: string;
  applicationStatusLabel: string;
  submittedLabel: string;
  reviewedLabel: string;
  reviewCycleLabel: string;
  submittedProfileRevisionLabel: string;
  submittedVideoRevisionLabel: string;
  videoStatusLabel: string;
  videoDurationLabel: string;
  videoRevisionLabel: string;
  videoSubmittedLabel: string;
  videoReviewedLabel: string;
  applicationNoteLabel: string;
  videoRejectionReasonLabel: string;
  noValue: string;
  years: string;
  accountActive: string;
  accountSuspended: string;
  accountDisabled: string;
  applicationDraft: string;
  applicationPendingReview: string;
  applicationApproved: string;
  applicationRejected: string;
  applicationSuspended: string;
  videoUploadPending: string;
  videoProcessing: string;
  videoReadyForReview: string;
  videoApproved: string;
  videoRejected: string;
  videoFailed: string;
  noVideo: string;
  playbackHeading: string;
  playbackDescription: string;
  playbackStart: string;
  playbackRefresh: string;
  playbackLoading: string;
  playbackActive: string;
  playbackExpiresSoon: string;
  playbackExpired: string;
  playbackUnavailableState: string;
  playbackUnauthorized: string;
  playbackForbidden: string;
  playbackConflict: string;
  playbackUnavailable: string;
  playbackGenericError: string;
  playbackPlayerTitle: string;
  decisionHeading: string;
  decisionDescription: string;
  decisionUnavailable: string;
  approveAction: string;
  rejectAction: string;
  approveHeading: string;
  approveDescription: string;
  approveUnavailable: string;
  approveConfirm: string;
  rejectHeading: string;
  rejectDescription: string;
  rejectTargetLabel: string;
  rejectProfile: string;
  rejectVideo: string;
  rejectBoth: string;
  profileReasonLabel: string;
  profileReasonPlaceholder: string;
  videoReasonLabel: string;
  videoReasonPlaceholder: string;
  rejectionReasonHint: string;
  rejectionTargetRequired: string;
  profileReasonRequired: string;
  videoReasonRequired: string;
  submitRejection: string;
  cancelDecision: string;
  decisionSubmitting: string;
  approveSuccess: string;
  rejectSuccess: string;
  decisionUnauthorized: string;
  decisionForbidden: string;
  decisionConflict: string;
  decisionInvalidRequest: string;
  decisionGenericError: string;
  decisionReload: string;
  moderationHeading: string;
  moderationDescription: string;
  moderationRestricted: string;
  moderationUnavailable: string;
  suspendAction: string;
  reinstateAction: string;
  suspendHeading: string;
  suspendDescription: string;
  reinstateHeading: string;
  reinstateDescription: string;
  moderationReasonLabel: string;
  suspendReasonPlaceholder: string;
  reinstateReasonPlaceholder: string;
  moderationReasonHint: string;
  moderationReasonRequired: string;
  suspendConfirm: string;
  reinstateConfirm: string;
  moderationCancel: string;
  moderationSubmitting: string;
  suspendSuccess: string;
  reinstateSuccess: string;
  moderationUnauthorized: string;
  moderationForbidden: string;
  moderationConflict: string;
  moderationInvalidRequest: string;
  moderationGenericError: string;
  moderationReload: string;
}

interface AdminReviewDetailProps {
  application: AdminReviewDetailApplication;
  decisionGuard: AdminReviewDecisionGuard | null;
  canApprove: boolean;
  canModerateTeachers: boolean;
  moderationGuard: AdminTeacherModerationGuard | null;
  copy: AdminReviewDetailCopy;
  formatDate: (value: Date) => string;
  formatDuration: (seconds: number | null) => string;
}

const accountStatusKey = {
  ACTIVE: "accountActive",
  SUSPENDED: "accountSuspended",
  DISABLED: "accountDisabled",
} as const satisfies Record<
  AdminReviewDetailApplication["user"]["accountStatus"],
  keyof AdminReviewDetailCopy
>;

const applicationStatusKey = {
  DRAFT: "applicationDraft",
  PENDING_REVIEW: "applicationPendingReview",
  APPROVED: "applicationApproved",
  REJECTED: "applicationRejected",
  SUSPENDED: "applicationSuspended",
} as const satisfies Record<
  AdminReviewDetailApplication["applicationStatus"],
  keyof AdminReviewDetailCopy
>;

const videoStatusKey = {
  UPLOAD_PENDING: "videoUploadPending",
  PROCESSING: "videoProcessing",
  READY_FOR_REVIEW: "videoReadyForReview",
  APPROVED: "videoApproved",
  REJECTED: "videoRejected",
  FAILED: "videoFailed",
} as const satisfies Record<
  NonNullable<AdminReviewDetailApplication["introVideo"]>["status"],
  keyof AdminReviewDetailCopy
>;

function valueOrFallback(value: string | null, fallback: string) {
  return value?.trim() ? value : fallback;
}

function Definition({
  label,
  children,
  inverse = false,
}: {
  label: string;
  children: ReactNode;
  inverse?: boolean;
}) {
  return (
    <div>
      <dt
        className={`text-xs font-semibold ${inverse ? "text-zinc-400" : "text-zinc-500"}`}
      >
        {label}
      </dt>
      <dd
        className={`mt-1.5 break-words text-sm font-medium ${inverse ? "text-zinc-100" : "text-zinc-900"}`}
      >
        {children}
      </dd>
    </div>
  );
}

export function AdminReviewDetail({
  application,
  decisionGuard,
  canApprove,
  canModerateTeachers,
  moderationGuard,
  copy,
  formatDate,
  formatDuration,
}: AdminReviewDetailProps) {
  const video = application.introVideo;
  const playbackEnabled = Boolean(
    application.snapshotAligned &&
      application.applicationStatus === "PENDING_REVIEW" &&
      application.user.accountStatus === "ACTIVE" &&
      video &&
      ["READY_FOR_REVIEW", "APPROVED"].includes(video.status),
  );

  return (
    <section aria-labelledby="admin-review-detail-title">
      <Link
        href="/admin/teacher-applications"
        className="inline-flex min-h-11 items-center rounded-xl text-sm font-semibold text-zinc-600 transition hover:text-zinc-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
      >
        {copy.backToQueue}
      </Link>

      <div className="mt-4 flex max-w-4xl flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-zinc-500">{copy.eyebrow}</p>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
            application.snapshotAligned
              ? "border-zinc-200 bg-white text-zinc-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {application.snapshotAligned
            ? copy.snapshotAligned
            : copy.snapshotChanged}
        </span>
      </div>

      <div className="mt-3 max-w-4xl">
        <h1
          id="admin-review-detail-title"
          className="text-4xl font-semibold text-zinc-950 sm:text-5xl lg:text-[3.5rem]"
        >
          {copy.title}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-600 sm:text-lg">
          {copy.description}
        </p>
        <p className="mt-4 font-mono text-xs text-zinc-500">
          {copy.applicationIdLabel}: {application.id}
        </p>
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <div className="space-y-6">
          <article className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold text-zinc-950">
              {copy.profileHeading}
            </h2>

            <dl className="mt-6 grid gap-6 sm:grid-cols-2">
              <Definition label={copy.headlineLabel}>
                {valueOrFallback(application.headline, copy.noValue)}
              </Definition>
              <Definition label={copy.experienceLabel}>
                {application.experienceYears === null
                  ? copy.noValue
                  : `${application.experienceYears} ${copy.years}`}
              </Definition>
              <Definition label={copy.nativeLanguageLabel}>
                {application.nativeLanguageLabel}
              </Definition>
              <Definition label={copy.teachingLanguageLabel}>
                {application.teachingLanguageLabel}
              </Definition>
              <Definition label={copy.timezoneLabel}>
                <span dir="ltr">{application.timezoneLabel}</span>
              </Definition>
              <Definition label={copy.profileCompletedLabel}>
                {application.profileCompletedAt
                  ? formatDate(application.profileCompletedAt)
                  : copy.noValue}
              </Definition>
              <Definition label={copy.profileRevisionLabel}>
                {application.profileRevision}
              </Definition>
            </dl>

            <div className="mt-7 border-t border-zinc-100 pt-6">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {copy.bioLabel}
              </h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-700">
                {valueOrFallback(application.bio, copy.noValue)}
              </p>
            </div>
          </article>

          <article className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold text-zinc-950">
              {copy.videoHeading}
            </h2>

            {video ? (
              <dl className="mt-6 grid gap-6 sm:grid-cols-2">
                <Definition label={copy.videoStatusLabel}>
                  {copy[videoStatusKey[video.status]]}
                </Definition>
                <Definition label={copy.videoDurationLabel}>
                  {formatDuration(video.durationSeconds)}
                </Definition>
                <Definition label={copy.videoRevisionLabel}>
                  {video.revision}
                </Definition>
                <Definition label={copy.submittedVideoRevisionLabel}>
                  {application.submittedVideoRevision ?? copy.noValue}
                </Definition>
                <Definition label={copy.videoSubmittedLabel}>
                  {video.submittedAt
                    ? formatDate(video.submittedAt)
                    : copy.noValue}
                </Definition>
                <Definition label={copy.videoReviewedLabel}>
                  {video.reviewedAt
                    ? formatDate(video.reviewedAt)
                    : copy.noValue}
                </Definition>
              </dl>
            ) : (
              <p className="mt-5 text-sm leading-7 text-zinc-600">
                {copy.noVideo}
              </p>
            )}

            {video?.rejectionReason ? (
              <div className="mt-7 border-t border-zinc-100 pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {copy.videoRejectionReasonLabel}
                </h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-700">
                  {video.rejectionReason}
                </p>
              </div>
            ) : null}
          </article>
        </div>

        <div className="space-y-6">
          <article className="rounded-[2rem] border border-zinc-200 bg-zinc-950 p-6 text-white shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold">{copy.identityHeading}</h2>
            <dl className="mt-6 grid gap-5">
              <Definition label={copy.applicantNameLabel} inverse>
                {application.user.name}
              </Definition>
              <Definition label={copy.applicantEmailLabel} inverse>
                {application.user.email}
              </Definition>
              <Definition label={copy.accountStatusLabel} inverse>
                {copy[accountStatusKey[application.user.accountStatus]]}
              </Definition>
              <Definition label={copy.applicationStatusLabel} inverse>
                {copy[applicationStatusKey[application.applicationStatus]]}
              </Definition>
            </dl>
          </article>

          <article className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold text-zinc-950">
              {copy.reviewSnapshotHeading}
            </h2>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
              <Definition label={copy.submittedLabel}>
                {application.applicationSubmittedAt
                  ? formatDate(application.applicationSubmittedAt)
                  : copy.noValue}
              </Definition>
              <Definition label={copy.reviewedLabel}>
                {application.applicationReviewedAt
                  ? formatDate(application.applicationReviewedAt)
                  : copy.noValue}
              </Definition>
              <Definition label={copy.reviewCycleLabel}>
                {application.reviewCycle}
              </Definition>
              <Definition label={copy.submittedProfileRevisionLabel}>
                {application.submittedProfileRevision ?? copy.noValue}
              </Definition>
              <Definition label={copy.submittedVideoRevisionLabel}>
                {application.submittedVideoRevision ?? copy.noValue}
              </Definition>
            </dl>

            {application.applicationReviewNote ? (
              <div className="mt-7 border-t border-zinc-100 pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {copy.applicationNoteLabel}
                </h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-700">
                  {application.applicationReviewNote}
                </p>
              </div>
            ) : null}
          </article>

          <aside className="rounded-[2rem] border border-zinc-200 bg-zinc-100 p-6 sm:p-7">
            <h2 className="text-lg font-semibold text-zinc-950">
              {copy.playbackHeading}
            </h2>
            <AdminReviewPlayback
              applicationId={application.id}
              enabled={playbackEnabled}
              copy={{
                description: copy.playbackDescription,
                start: copy.playbackStart,
                refresh: copy.playbackRefresh,
                loading: copy.playbackLoading,
                active: copy.playbackActive,
                expiresSoon: copy.playbackExpiresSoon,
                expired: copy.playbackExpired,
                unavailableState: copy.playbackUnavailableState,
                unauthorized: copy.playbackUnauthorized,
                forbidden: copy.playbackForbidden,
                conflict: copy.playbackConflict,
                unavailable: copy.playbackUnavailable,
                genericError: copy.playbackGenericError,
                playerTitle: copy.playbackPlayerTitle,
              }}
            />
          </aside>

          <aside className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold text-zinc-950">
              {copy.decisionHeading}
            </h2>
            <AdminReviewDecision
              key={
                decisionGuard
                  ? `${decisionGuard.reviewCycle}:${decisionGuard.profileRevision}:${decisionGuard.videoId}:${decisionGuard.videoRevision}`
                  : "unavailable"
              }
              applicationId={application.id}
              guard={decisionGuard}
              canApprove={canApprove}
              copy={{
                description: copy.decisionDescription,
                unavailable: copy.decisionUnavailable,
                approve: copy.approveAction,
                reject: copy.rejectAction,
                approveHeading: copy.approveHeading,
                approveDescription: copy.approveDescription,
                approveUnavailable: copy.approveUnavailable,
                approveConfirm: copy.approveConfirm,
                rejectHeading: copy.rejectHeading,
                rejectDescription: copy.rejectDescription,
                rejectTargetLabel: copy.rejectTargetLabel,
                rejectProfile: copy.rejectProfile,
                rejectVideo: copy.rejectVideo,
                rejectBoth: copy.rejectBoth,
                profileReasonLabel: copy.profileReasonLabel,
                profileReasonPlaceholder: copy.profileReasonPlaceholder,
                videoReasonLabel: copy.videoReasonLabel,
                videoReasonPlaceholder: copy.videoReasonPlaceholder,
                reasonHint: copy.rejectionReasonHint,
                targetRequired: copy.rejectionTargetRequired,
                profileReasonRequired: copy.profileReasonRequired,
                videoReasonRequired: copy.videoReasonRequired,
                submitRejection: copy.submitRejection,
                cancel: copy.cancelDecision,
                submitting: copy.decisionSubmitting,
                approveSuccess: copy.approveSuccess,
                rejectSuccess: copy.rejectSuccess,
                unauthorized: copy.decisionUnauthorized,
                forbidden: copy.decisionForbidden,
                conflict: copy.decisionConflict,
                invalidRequest: copy.decisionInvalidRequest,
                genericError: copy.decisionGenericError,
                reload: copy.decisionReload,
              }}
            />
          </aside>

          <aside className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold text-zinc-950">
              {copy.moderationHeading}
            </h2>
            <AdminTeacherModeration
              key={
                moderationGuard
                  ? `${moderationGuard.action}:${moderationGuard.reviewCycle}`
                  : canModerateTeachers
                    ? "unavailable"
                    : "restricted"
              }
              applicationId={application.id}
              canModerateTeachers={canModerateTeachers}
              guard={moderationGuard}
              copy={{
                description: copy.moderationDescription,
                restricted: copy.moderationRestricted,
                unavailable: copy.moderationUnavailable,
                suspendAction: copy.suspendAction,
                reinstateAction: copy.reinstateAction,
                suspendHeading: copy.suspendHeading,
                suspendDescription: copy.suspendDescription,
                reinstateHeading: copy.reinstateHeading,
                reinstateDescription: copy.reinstateDescription,
                reasonLabel: copy.moderationReasonLabel,
                suspendReasonPlaceholder: copy.suspendReasonPlaceholder,
                reinstateReasonPlaceholder: copy.reinstateReasonPlaceholder,
                reasonHint: copy.moderationReasonHint,
                reasonRequired: copy.moderationReasonRequired,
                suspendConfirm: copy.suspendConfirm,
                reinstateConfirm: copy.reinstateConfirm,
                cancel: copy.moderationCancel,
                submitting: copy.moderationSubmitting,
                suspendSuccess: copy.suspendSuccess,
                reinstateSuccess: copy.reinstateSuccess,
                unauthorized: copy.moderationUnauthorized,
                forbidden: copy.moderationForbidden,
                conflict: copy.moderationConflict,
                invalidRequest: copy.moderationInvalidRequest,
                genericError: copy.moderationGenericError,
                reload: copy.moderationReload,
              }}
            />
          </aside>
        </div>
      </div>
    </section>
  );
}
