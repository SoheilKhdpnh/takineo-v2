// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import faMessages from "@/messages/fa.json";

const copy = {
  currentStatus: "Current video status",
  statusMissing: "No video",
  statusReadyForReview: "Ready",
  statusApproved: "Approved",
  statusRejected: "Replace your video before resubmitting.",
  statusRetiredProvider: "Provider retired",
  reviewFeedbackTitle: "Review feedback",
  reviewFeedbackUnavailable: "No detailed reviewer feedback is available.",
  verificationTitle: "Say this code",
  spokenInstruction: "Say the phrase.",
  spokenScript: "{phrase}, {code}",
  requirementsTitle: "Recording guide",
  requirementDuration: "Duration requirement",
  requirementSpoken: "Spoken requirement",
  requirementContent: "Content requirement",
  requirementLanguage: "Language requirement",
  requirementPublic: "Public warning",
  urlLabel: "Aparat video link",
  urlPlaceholder: "https://www.aparat.com/v/...",
  urlHint: "Only aparat.com",
  saveLink: "Save Aparat link",
  replaceVideo: "Replace Aparat link",
  saving: "Saving",
  saveSuccess: "Saved",
  invalidUrl: "Invalid URL",
  profileIncomplete: "Profile incomplete",
  networkError: "Network error",
  applicationLocked: "Application locked",
  pendingLocked: "Pending locked",
  previewTitle: "Preview",
  previewDescription: "Preview description",
  previewPlayerTitle: "Preview player",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: keyof typeof copy, values?: Record<string, string>) => {
    const template = copy[key];
    if (!values) {
      return template;
    }

    return Object.entries(values).reduce(
      (current, [name, value]) => current.replaceAll(`{${name}}`, value),
      template,
    );
  },
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { TeacherIntroVideoUploader } from "@/components/profiles/TeacherIntroVideoUploader";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TeacherIntroVideoUploader", () => {
  it("shows the exact applicant-safe admin reason for a rejected video", () => {
    const feedback =
      "Please record in a quieter room and keep your face clearly visible.";

    render(
      <TeacherIntroVideoUploader
        applicationStatus="REJECTED"
        canEdit
        verificationCode="AB12C"
        initialVideo={{
          status: "REJECTED",
          aparatUrl: "https://www.aparat.com/v/abcDE12",
          embedUrl: "https://www.aparat.com/video/video/embed/videohash/abcDE12/vt/frame",
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
    expect(screen.getByText("AB12C")).toBeInTheDocument();
  });

  it("uses a safe fallback for rejected videos with no detailed reason", () => {
    render(
      <TeacherIntroVideoUploader
        applicationStatus="REJECTED"
        canEdit
        verificationCode="AB12C"
        initialVideo={{
          status: "REJECTED",
          aparatUrl: null,
          embedUrl: null,
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
        canEdit
        verificationCode="AB12C"
        initialVideo={{
          status: "READY_FOR_REVIEW",
          aparatUrl: "https://www.aparat.com/v/abcDE12",
          embedUrl: "https://www.aparat.com/video/video/embed/videohash/abcDE12/vt/frame",
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
  });
});
