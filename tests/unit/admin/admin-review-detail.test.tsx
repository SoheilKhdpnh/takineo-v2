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
  videoDurationLabel: "Processed duration",
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
  playbackHeading: "Private video review",
  playbackDeferred: "Playback arrives later.",
  actionsDeferred: "Decisions arrive later.",
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
  user: {
    name: "Teacher Applicant",
    email: "teacher@example.com",
    accountStatus: "ACTIVE",
  },
  introVideo: {
    revision: 4,
    status: "READY_FOR_REVIEW",
    durationSeconds: 90,
    rejectionReason: null,
    submittedAt: new Date("2026-08-13T09:50:00.000Z"),
    reviewedAt: null,
  },
};

describe("AdminReviewDetail", () => {
  it("renders a complete read-only review detail without decision or playback controls", () => {
    render(
      <AdminReviewDetail
        application={application}
        copy={copy}
        formatDate={() => "Aug 13, 2026, 1:30 PM"}
        formatDuration={() => "90 sec"}
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
    expect(screen.getByText("90 sec")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to review queue" }),
    ).toHaveAttribute("href", "/admin/teacher-applications");

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/playback-id/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/asset-id/i)).not.toBeInTheDocument();
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
        copy={copy}
        formatDate={() => "Submitted time"}
        formatDuration={() => "Unavailable"}
      />,
    );

    expect(screen.getByText("Snapshot changed or incomplete")).toBeInTheDocument();
    expect(screen.getByText("No introduction video")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
