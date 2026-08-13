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
  AdminReviewQueue,
  type AdminQueueApplication,
} from "@/components/admin/AdminReviewQueue";

afterEach(() => {
  cleanup();
});

const copy = {
  emptyTitle: "The review queue is clear",
  emptyDescription: "No pending applications.",
  submittedLabel: "Submitted",
  reviewCycleLabel: "Review cycle",
  videoLabel: "Video",
  durationLabel: "Duration",
  accountLabel: "Account",
  snapshotLabel: "Application ID",
  snapshotReady: "Review data ready",
  snapshotIncomplete: "Needs attention",
  noSubmissionDate: "Unavailable",
  noVideo: "No submitted video",
  noDuration: "Unavailable",
  accountActive: "Active",
  accountSuspended: "Suspended",
  accountDisabled: "Disabled",
  videoUploadPending: "Upload pending",
  videoProcessing: "Processing",
  videoReadyForReview: "Ready for review",
  videoApproved: "Approved",
  videoRejected: "Rejected",
  videoFailed: "Failed",
  nextPage: "Next page",
  endOfQueue: "End of queue",
};

const completeApplication: AdminQueueApplication = {
  id: "ck12345678901234567890123",
  reviewCycle: 2,
  submittedProfileRevision: 3,
  submittedVideoId: "ck22345678901234567890123",
  submittedVideoRevision: 4,
  applicationSubmittedAt: new Date("2026-08-13T10:00:00.000Z"),
  user: {
    name: "Teacher Applicant",
    email: "teacher@example.com",
    accountStatus: "ACTIVE",
  },
  introVideo: {
    id: "ck22345678901234567890123",
    revision: 4,
    status: "READY_FOR_REVIEW",
    durationSeconds: 90,
  },
};

describe("AdminReviewQueue", () => {
  it("renders review snapshot metadata and cursor pagination without review actions", () => {
    render(
      <AdminReviewQueue
        applications={[completeApplication]}
        nextCursor="ck32345678901234567890123"
        copy={copy}
        formatSubmittedAt={() => "Aug 13, 2026, 1:30 PM"}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Teacher Applicant" }),
    ).toBeInTheDocument();
    expect(screen.getByText("teacher@example.com")).toBeInTheDocument();
    expect(screen.getByText("Review data ready")).toBeInTheDocument();
    expect(screen.getByText("Ready for review")).toBeInTheDocument();
    expect(screen.getByText("1:30")).toBeInTheDocument();
    expect(screen.getByText("Aug 13, 2026, 1:30 PM")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/admin/teacher-applications?cursor=ck32345678901234567890123",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("flags malformed review snapshots instead of presenting them as ready", () => {
    render(
      <AdminReviewQueue
        applications={[
          {
            ...completeApplication,
            submittedVideoId: null,
            submittedVideoRevision: null,
            introVideo: null,
          },
        ]}
        nextCursor={null}
        copy={copy}
        formatSubmittedAt={() => "Submitted time"}
      />,
    );

    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("No submitted video")).toBeInTheDocument();
    expect(screen.getByText("End of queue")).toBeInTheDocument();
  });

  it("renders a clear empty state", () => {
    render(
      <AdminReviewQueue
        applications={[]}
        nextCursor={null}
        copy={copy}
        formatSubmittedAt={() => "Submitted time"}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "The review queue is clear" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No pending applications.")).toBeInTheDocument();
  });
});
