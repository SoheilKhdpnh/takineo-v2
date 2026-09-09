// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import faMessages from "@/messages/fa.json";

const copy = {
  currentStatus: "Current video status",
  statusMissing: "No video",
  statusUploadPending: "Upload pending",
  statusProcessing: "Processing",
  statusReadyForReview: "Ready",
  statusApproved: "Approved",
  statusRejected: "Replace your video before resubmitting.",
  statusFailed: "Failed",
  durationRejected: "Your video is outside the required duration.",
  reviewFeedbackTitle: "Review feedback",
  reviewFeedbackUnavailable: "No detailed reviewer feedback is available.",
  duration: "Duration",
  requirementsTitle: "Recording guide",
  requirementDuration: "Duration requirement",
  requirementContent: "Content requirement",
  requirementLanguage: "Language requirement",
  requirementConsent: "Consent requirement",
  selectVideo: "Select video",
  replaceVideo: "Replace video",
  creatingUpload: "Preparing",
  uploadError: "Upload error",
  createUploadError: "Create error",
  providerUnavailable: "Provider unavailable",
  networkError: "Network error",
  applicationLocked: "Application locked",
  pendingLocked: "Pending locked",
  checkStatus: "Check status",
  checkingStatus: "Checking",
  statusSaveError: "Save error",
  statusSyncError: "Sync error",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: keyof typeof copy) => copy[key],
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@mux/mux-uploader-react", () => ({
  default: () => <div data-testid="mux-uploader" />,
}));

import { TeacherIntroVideoUploader } from "@/components/profiles/TeacherIntroVideoUploader";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TeacherIntroVideoUploader rejection feedback", () => {
  it("shows the exact applicant-safe admin reason for a rejected video", () => {
    const feedback =
      "Please record in a quieter room and keep your face clearly visible.";

    render(
      <TeacherIntroVideoUploader
        applicationStatus="REJECTED"
        canUpload
        initialVideo={{
          status: "REJECTED",
          durationSeconds: 91,
          rejectionReason: feedback,
        }}
      />,
    );

    const region = screen.getByRole("region", {
      name: copy.reviewFeedbackTitle,
    });

    expect(region).toHaveTextContent(feedback);
    expect(region).not.toHaveTextContent(copy.reviewFeedbackUnavailable);
    expect(screen.getByText(copy.statusRejected)).toBeInTheDocument();
  });

  it("translates the duration-system rejection instead of exposing its internal code", () => {
    render(
      <TeacherIntroVideoUploader
        applicationStatus="REJECTED"
        canUpload
        initialVideo={{
          status: "REJECTED",
          durationSeconds: 143,
          rejectionReason: "VIDEO_DURATION_OUT_OF_RANGE",
        }}
      />,
    );

    expect(screen.getByText(copy.durationRejected)).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: copy.reviewFeedbackTitle }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("VIDEO_DURATION_OUT_OF_RANGE"),
    ).not.toBeInTheDocument();
  });

  it("uses a safe fallback for legacy rejected videos with no detailed reason", () => {
    render(
      <TeacherIntroVideoUploader
        applicationStatus="REJECTED"
        canUpload
        initialVideo={{
          status: "REJECTED",
          durationSeconds: 82,
          rejectionReason: null,
        }}
      />,
    );

    expect(
      screen.getByRole("region", { name: copy.reviewFeedbackTitle }),
    ).toHaveTextContent(copy.reviewFeedbackUnavailable);
  });

  it("does not surface a retained rejection reason once the video is no longer rejected", () => {
    render(
      <TeacherIntroVideoUploader
        applicationStatus="DRAFT"
        canUpload
        initialVideo={{
          status: "READY_FOR_REVIEW",
          durationSeconds: 84,
          rejectionReason: "Old feedback that must remain hidden.",
        }}
      />,
    );

    expect(
      screen.queryByRole("region", { name: copy.reviewFeedbackTitle }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Old feedback that must remain hidden."),
    ).not.toBeInTheDocument();
  });

  it("keeps the English and Persian video-feedback catalogs in parity", () => {
    expect(Object.keys(faMessages.TeacherVideo).sort()).toEqual(
      Object.keys(enMessages.TeacherVideo).sort(),
    );
    expect(enMessages.TeacherVideo.reviewFeedbackTitle.trim()).not.toBe("");
    expect(faMessages.TeacherVideo.reviewFeedbackTitle.trim()).not.toBe("");
  });
});
