// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
  useRouter: () => ({ refresh: vi.fn() }),
}));

import {
  AdminReviewDetail,
  type AdminReviewDetailApplication,
} from "@/components/admin/AdminReviewDetail";

afterEach(() => {
  cleanup();
});

const copy = {
  backToQueue: "Back to review queue",
  eyebrow: "Application detail",
  title: "Application — Teacher Applicant",
  description: "Read-only detail",
  applicationIdLabel: "Application ID",
  snapshotAligned: "Snapshot aligned",
  snapshotChanged: "Snapshot changed or incomplete",
  profileHeading: "Teacher profile",
  identityHeading: "Applicant",
  reviewSnapshotHeading: "Review snapshot",
  videoHeading: "Introduction video",
  headlineLabel: "Professional headline",
  bioLabel: "Professional biography",
  experienceLabel: "Teaching experience",
  nativeLanguageLabel: "Native language",
  teachingLanguageLabel: "Teaching language",
  timezoneLabel: "Time zone",
  profileCompletedLabel: "Profile completed",
  profileRevisionLabel: "Current profile revision",
  applicantNameLabel: "Name",
  applicantEmailLabel: "Email",
  accountStatusLabel: "Account",
  applicationStatusLabel: "Application",
  submittedLabel: "Application submitted",
  reviewedLabel: "Application reviewed",
  reviewCycleLabel: "Review cycle",
  submittedProfileRevisionLabel: "Submitted profile revision",
  submittedVideoRevisionLabel: "Submitted video revision",
  videoStatusLabel: "Video status",
  videoUrlLabel: "Aparat link",
  videoRevisionLabel: "Current video revision",
  videoSubmittedLabel: "Video submitted",
  videoReviewedLabel: "Video reviewed",
  applicationNoteLabel: "Latest application review note",
  videoRejectionReasonLabel: "Latest video rejection reason",
  noValue: "Unavailable",
  years: "years",
  accountActive: "Active",
  accountSuspended: "Suspended",
  accountDisabled: "Disabled",
  applicationDraft: "Draft",
  applicationPendingReview: "Pending review",
  applicationApproved: "Approved",
  applicationRejected: "Rejected",
  applicationSuspended: "Suspended",
  videoUploadPending: "Upload pending",
  videoProcessing: "Processing",
  videoReadyForReview: "Ready for review",
  videoApproved: "Approved",
  videoRejected: "Rejected",
  videoFailed: "Failed",
  noVideo: "No introduction video",
  playbackHeading: "Introduction video",
  playbackDescription: "Watch the submitted Aparat video.",
  playbackCodeLabel: "Expected spoken code",
  playbackSpokenPhraseLabel: "Expected spoken phrase",
  playbackSpokenPhrase: "This video is recorded for the Talkinu team",
  playbackUnavailableState: "Playback unavailable for this state.",
  playbackPublicHostNote: "This player embeds a public Aparat URL.",
  playbackPlayerTitle: "Teacher introduction video",
  decisionHeading: "Review decision",
  decisionDescription: "Decide against the current snapshot.",
  decisionUnavailable: "Decision unavailable.",
  approveAction: "Approve application",
  rejectAction: "Reject application",
  approveHeading: "Confirm approval",
  approveDescription: "Approve the submitted profile and video.",
  approveUnavailable: "Approval unavailable.",
  approveConfirm: "Confirm approval",
  spokenCodeLabel: "I confirmed the applicant said their verification code.",
  spokenCodeRequired: "Confirm the spoken code.",
  approveVisibilityNote: "Approval only controls Talkinu visibility.",
  rejectHeading: "Record a rejection",
  rejectDescription: "Choose what failed review.",
  rejectTargetLabel: "Reject",
  rejectProfile: "Profile only",
  rejectVideo: "Video only",
  rejectBoth: "Profile and video",
  profileReasonLabel: "Profile rejection reason",
  profileReasonPlaceholder: "Profile reason",
  videoReasonLabel: "Video rejection reason",
  videoReasonPlaceholder: "Video reason",
  rejectionReasonHint: "Specific reasons required.",
  rejectionTargetRequired: "Choose a target.",
  profileReasonRequired: "Profile reason required.",
  videoReasonRequired: "Video reason required.",
  submitRejection: "Confirm rejection",
  cancelDecision: "Cancel",
  decisionSubmitting: "Saving decision…",
  approveSuccess: "Application approved.",
  rejectSuccess: "Application rejected.",
  decisionUnauthorized: "Session unavailable.",
  decisionForbidden: "Admin access revoked.",
  decisionConflict: "Review changed.",
  decisionInvalidRequest: "Invalid decision.",
  decisionGenericError: "Decision failed.",
  decisionReload: "Reload review",
  moderationHeading: "Teacher access moderation",
  moderationDescription: "Moderation is separate from review.",
  moderationRestricted: "Super-admin access required.",
  moderationUnavailable: "No moderation transition available.",
  suspendAction: "Suspend teacher",
  reinstateAction: "Reinstate teacher",
  suspendHeading: "Confirm teacher suspension",
  suspendDescription: "Suspension description.",
  reinstateHeading: "Confirm teacher reinstatement",
  reinstateDescription: "Reinstatement description.",
  moderationReasonLabel: "Moderation reason",
  suspendReasonPlaceholder: "Suspension reason",
  reinstateReasonPlaceholder: "Reinstatement reason",
  moderationReasonHint: "Specific reason required.",
  moderationReasonRequired: "Moderation reason required.",
  suspendConfirm: "Confirm suspension",
  reinstateConfirm: "Confirm reinstatement",
  moderationCancel: "Cancel",
  moderationSubmitting: "Saving moderation change…",
  suspendSuccess: "Teacher suspended.",
  reinstateSuccess: "Teacher reinstated.",
  moderationUnauthorized: "Session unavailable.",
  moderationForbidden: "Moderation forbidden.",
  moderationConflict: "Teacher state changed.",
  moderationInvalidRequest: "Invalid moderation request.",
  moderationGenericError: "Moderation failed.",
  moderationReload: "Reload teacher state",
};

const application: AdminReviewDetailApplication = {
  id: "ck12345678901234567890123",
  headline: "Speaking coach for intermediate learners",
  bio: "A detailed professional biography for review.",
  experienceYears: 6,
  nativeLanguageLabel: "Persian",
  teachingLanguageLabel: "English",
  timezoneLabel: "Asia/Tehran",
  profileCompletedAt: new Date("2026-08-10T10:00:00.000Z"),
  profileRevision: 3,
  applicationStatus: "PENDING_REVIEW",
  applicationSubmittedAt: new Date("2026-08-13T10:00:00.000Z"),
  applicationReviewedAt: null,
  applicationReviewNote: null,
  reviewCycle: 2,
  submittedProfileRevision: 3,
  submittedVideoRevision: 4,
  snapshotAligned: true,
  videoVerificationCode: "AB12C",
  user: {
    name: "Teacher Applicant",
    email: "teacher@example.com",
    accountStatus: "ACTIVE",
  },
  introVideo: {
    revision: 4,
    status: "READY_FOR_REVIEW",
    aparatUrl: "https://www.aparat.com/v/abcDE12",
    embedUrl: "https://www.aparat.com/video/video/embed/videohash/abcDE12/vt/frame",
    rejectionReason: null,
    submittedAt: new Date("2026-08-13T09:50:00.000Z"),
    reviewedAt: null,
  },
};

describe("AdminReviewDetail", () => {
  it("renders a complete review detail with Aparat playback and guarded decision entry", () => {
    render(
      <AdminReviewDetail
        application={application}
        decisionGuard={{
          reviewCycle: 2,
          profileRevision: 3,
          videoId: "ck22345678901234567890123",
          videoRevision: 4,
        }}
        canApprove
        canModerateTeachers={false}
        moderationGuard={null}
        copy={copy}
        formatDate={() => "Aug 13, 2026, 1:30 PM"}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Application — Teacher Applicant" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Snapshot aligned")).toBeInTheDocument();
    expect(screen.getByText("teacher@example.com")).toBeInTheDocument();
    expect(screen.getByText("Speaking coach for intermediate learners")).toBeInTheDocument();
    expect(screen.getByText("A detailed professional biography for review.")).toBeInTheDocument();
    expect(screen.getByText("Asia/Tehran")).toBeInTheDocument();
    expect(screen.getByText("Ready for review")).toBeInTheDocument();
    expect(screen.getByText("AB12C")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to review queue" }),
    ).toHaveAttribute("href", "/admin/teacher-applications");

    expect(
      screen.getByTitle("Teacher introduction video"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve application" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reject application" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/playback-id/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/asset-id/i)).not.toBeInTheDocument();
    expect(screen.getByText(copy.moderationRestricted)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: copy.suspendAction }),
    ).not.toBeInTheDocument();
  });

  it("surfaces an incomplete snapshot and missing video without inventing review actions", () => {
    render(
      <AdminReviewDetail
        application={{
          ...application,
          snapshotAligned: false,
          submittedVideoRevision: null,
          introVideo: null,
        }}
        decisionGuard={null}
        canApprove={false}
        canModerateTeachers={false}
        moderationGuard={null}
        copy={copy}
        formatDate={() => "Submitted time"}
      />,
    );

    expect(screen.getByText("Snapshot changed or incomplete")).toBeInTheDocument();
    expect(screen.getByText("No introduction video")).toBeInTheDocument();
    expect(screen.getByText("Playback unavailable for this state.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: copy.approveAction }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: copy.rejectAction }),
    ).not.toBeInTheDocument();
  });
});
