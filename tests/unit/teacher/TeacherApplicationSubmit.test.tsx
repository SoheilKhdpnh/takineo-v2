// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import faMessages from "@/messages/fa.json";

const copy = {
  title: "Submit your teaching application",
  description: "Complete your application.",
  profileCheck: "Professional profile completed",
  videoCheck: "Introduction video ready for review",
  submit: "Submit application",
  submitting: "Submitting application...",
  confirmation: "Submit?",
  profileIncomplete: "Profile incomplete",
  videoMissing: "Video missing",
  videoNotReady: "Video not ready",
  submitError: "Submit failed",
  networkError: "Network failed",
  pendingTitle: "Pending",
  pendingDescription: "Pending description",
  approvedTitle: "Approved",
  approvedDescription: "Approved description",
  rejectedTitle: "Changes requested before resubmission",
  rejectedProfileDescription: "Profile changes requested.",
  rejectedVideoDescription: "Video changes requested.",
  reviewerFeedback: "Review feedback",
  reviewerFeedbackUnavailable: "No detailed feedback available.",
  suspendedTitle: "Suspended",
  suspendedDescription: "Suspended description",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: keyof typeof copy) => copy[key],
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { TeacherApplicationSubmit } from "@/components/profiles/TeacherApplicationSubmit";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TeacherApplicationSubmit rejection feedback", () => {
  it("renders the applicant-safe review note for a rejected profile", () => {
    const feedback = "Clarify your teaching experience and add concrete examples.";

    render(
      <TeacherApplicationSubmit
        applicationStatus="REJECTED"
        profileCompleted
        videoStatus="APPROVED"
        rejectionFeedback={feedback}
      />,
    );

    const feedbackRegion = screen.getByRole("region", {
      name: copy.rejectedTitle,
    });

    expect(feedbackRegion).toHaveTextContent(copy.rejectedProfileDescription);
    expect(feedbackRegion).toHaveTextContent(copy.reviewerFeedback);
    expect(feedbackRegion).toHaveTextContent(feedback);
    expect(
      screen.queryByText(copy.rejectedVideoDescription),
    ).not.toBeInTheDocument();
  });

  it("uses video-aware guidance and a safe fallback when legacy rejection feedback is absent", () => {
    render(
      <TeacherApplicationSubmit
        applicationStatus="REJECTED"
        profileCompleted
        videoStatus="REJECTED"
        rejectionFeedback={null}
      />,
    );

    const feedbackRegion = screen.getByRole("region", {
      name: copy.rejectedTitle,
    });

    expect(feedbackRegion).toHaveTextContent(copy.rejectedVideoDescription);
    expect(feedbackRegion).toHaveTextContent(copy.reviewerFeedbackUnavailable);
  });

  it("keeps Persian and English applicant-feedback copy in structural parity", () => {
    expect(Object.keys(faMessages.TeacherApplicationSubmit).sort()).toEqual(
      Object.keys(enMessages.TeacherApplicationSubmit).sort(),
    );
    expect(faMessages.TeacherApplicationSubmit.rejectedTitle.trim()).not.toBe(
      "",
    );
    expect(enMessages.TeacherApplicationSubmit.rejectedTitle.trim()).not.toBe(
      "",
    );
  });

  it("does not expose rejection feedback outside the rejected application state", () => {
    render(
      <TeacherApplicationSubmit
        applicationStatus="DRAFT"
        profileCompleted
        videoStatus="READY_FOR_REVIEW"
        rejectionFeedback="Old review note that must not be shown in draft state."
      />,
    );

    expect(
      screen.queryByRole("region", { name: copy.rejectedTitle }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Old review note that must not be shown in draft state."),
    ).not.toBeInTheDocument();
  });
});
