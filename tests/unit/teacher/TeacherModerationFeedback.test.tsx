// @vitest-environment jsdom

import type { AnchorHTMLAttributes } from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import faMessages from "@/messages/fa.json";

const mocks = vi.hoisted(() => ({
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
  requireRolePage: vi.fn(),
  getTeacherProfileForUser: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock("next-intl", () => ({
  hasLocale: (locales: readonly string[], locale: string) =>
    locales.includes(locale),
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/auth/page-guards", () => ({
  requireRolePage: mocks.requireRolePage,
}));

vi.mock("@/lib/services/teacher-profile.service", () => ({
  getTeacherProfileForUser: mocks.getTeacherProfileForUser,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  redirect: mocks.redirect,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/auth/SignOutButton", () => ({
  SignOutButton: () => null,
}));

vi.mock("@/components/sessions/UpcomingSessionsPanel", () => ({
  UpcomingSessionsPanel: () => (
    <div data-testid="upcoming-sessions" />
  ),
}));

vi.mock("@/components/availability/TeacherAvailabilityPanel", () => ({
  TeacherAvailabilityPanel: () => (
    <div data-testid="teacher-availability" />
  ),
}));

vi.mock("@/components/profiles/TeacherApplicationSubmit", () => ({
  TeacherApplicationSubmit: ({
    applicationStatus,
    rejectionFeedback,
  }: {
    applicationStatus: string;
    rejectionFeedback: string | null;
  }) => (
    <div
      data-testid="application-submit"
      data-status={applicationStatus}
      data-feedback={rejectionFeedback ?? ""}
    />
  ),
}));

import TeacherDashboardPage from "@/app/[locale]/teacher/dashboard/page";

const internalModerationReason =
  "Internal moderation note: investigate repeated policy reports before reinstatement.";

const baseProfile = {
  id: "teacher-profile",
  userId: "teacher-user",
  headline: "Experienced English teacher",
  bio: "Teacher biography",
  experienceYears: 6,
  nativeLanguage: "Persian",
  teachingLanguage: "English",
  timezone: "Asia/Tehran",
  profileCompletedAt: new Date("2026-08-01T08:00:00.000Z"),
  applicationStatus: "SUSPENDED" as const,
  applicationSubmittedAt: new Date("2026-08-10T08:00:00.000Z"),
  applicationReviewedAt: new Date("2026-08-11T08:00:00.000Z"),
  applicationReviewNote: internalModerationReason,
  profileRevision: 4,
  createdAt: new Date("2026-07-01T08:00:00.000Z"),
  updatedAt: new Date("2026-08-11T08:00:00.000Z"),
  introVideo: {
    id: "video-id",
    revision: 2,
    status: "APPROVED" as const,
    durationSeconds: 84,
    rejectionReason: null,
    submittedAt: new Date("2026-08-10T08:00:00.000Z"),
    reviewedAt: new Date("2026-08-11T08:00:00.000Z"),
  },
};

beforeEach(() => {
  mocks.getTranslations.mockReset();
  mocks.setRequestLocale.mockReset();
  mocks.requireRolePage.mockReset();
  mocks.getTeacherProfileForUser.mockReset();
  mocks.redirect.mockReset();

  mocks.getTranslations.mockResolvedValue((key: string) => key);
  mocks.requireRolePage.mockResolvedValue({
    session: { user: { id: "teacher-user" } },
    access: {
      role: "TEACHER",
      accountStatus: "ACTIVE",
      teacherProfile: {
        id: "teacher-profile",
        applicationStatus: "SUSPENDED",
        profileCompletedAt: baseProfile.profileCompletedAt,
        introVideo: {
          id: "video-id",
          status: "APPROVED",
          durationSeconds: 84,
        },
      },
    },
  });
  mocks.getTeacherProfileForUser.mockResolvedValue(baseProfile);
  mocks.redirect.mockImplementation(() => {
    throw new Error("REDIRECT");
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("teacher moderation feedback policy", () => {
  it("does not serialize an internal suspension reason into the teacher client workspace", async () => {
    const page = await TeacherDashboardPage({
      params: Promise.resolve({ locale: "en" }),
    });

    render(page);

    expect(screen.getByTestId("application-submit")).toHaveAttribute(
      "data-status",
      "SUSPENDED",
    );
    expect(screen.getByTestId("application-submit")).toHaveAttribute(
      "data-feedback",
      "",
    );
    expect(screen.queryByText(internalModerationReason)).not.toBeInTheDocument();
  });

  it("does not serialize an internal reinstatement reason after the teacher returns to approved", async () => {
    mocks.getTeacherProfileForUser.mockResolvedValue({
      ...baseProfile,
      applicationStatus: "APPROVED",
      applicationReviewNote:
        "Internal reinstatement note: operations verified the remediation evidence.",
    });

    const page = await TeacherDashboardPage({
      params: Promise.resolve({ locale: "fa" }),
    });

    render(page);

    expect(screen.getByTestId("application-submit")).toHaveAttribute(
      "data-status",
      "APPROVED",
    );
    expect(screen.getByTestId("application-submit")).toHaveAttribute(
      "data-feedback",
      "",
    );
  });

  it("continues to pass exact applicant review feedback only for rejected applications", async () => {
    const applicantFeedback =
      "Clarify the teaching methodology before resubmitting.";
    mocks.getTeacherProfileForUser.mockResolvedValue({
      ...baseProfile,
      applicationStatus: "REJECTED",
      applicationReviewNote: applicantFeedback,
    });

    const page = await TeacherDashboardPage({
      params: Promise.resolve({ locale: "en" }),
    });

    render(page);

    expect(screen.getByTestId("application-submit")).toHaveAttribute(
      "data-feedback",
      applicantFeedback,
    );
  });

  it("defensively hides a supplied moderation note inside the suspended client component", async () => {
    const { TeacherApplicationSubmit } = await vi.importActual<
      typeof import("@/components/profiles/TeacherApplicationSubmit")
    >("@/components/profiles/TeacherApplicationSubmit");

    render(
      <TeacherApplicationSubmit
        applicationStatus="SUSPENDED"
        profileCompleted
        videoStatus="APPROVED"
        rejectionFeedback={internalModerationReason}
      />,
    );

    expect(screen.getByText("suspendedDescription")).toBeInTheDocument();
    expect(screen.queryByText(internalModerationReason)).not.toBeInTheDocument();
  });

  it("uses the generic approved state after reinstatement without exposing moderation history", async () => {
    const { TeacherApplicationSubmit } = await vi.importActual<
      typeof import("@/components/profiles/TeacherApplicationSubmit")
    >("@/components/profiles/TeacherApplicationSubmit");

    render(
      <TeacherApplicationSubmit
        applicationStatus="APPROVED"
        profileCompleted
        videoStatus="APPROVED"
        rejectionFeedback="Internal reinstatement history"
      />,
    );

    expect(screen.getByText("approvedDescription")).toBeInTheDocument();
    expect(
      screen.queryByText("Internal reinstatement history"),
    ).not.toBeInTheDocument();
  });

  it("keeps the public moderation-status copy localized in both catalogs", () => {
    expect(Object.keys(faMessages.TeacherApplicationSubmit).sort()).toEqual(
      Object.keys(enMessages.TeacherApplicationSubmit).sort(),
    );
    expect(enMessages.TeacherApplicationSubmit.suspendedDescription.trim()).not.toBe(
      "",
    );
    expect(faMessages.TeacherApplicationSubmit.suspendedDescription.trim()).not.toBe(
      "",
    );
    expect(enMessages.TeacherApplicationSubmit.approvedDescription.trim()).not.toBe(
      "",
    );
    expect(faMessages.TeacherApplicationSubmit.approvedDescription.trim()).not.toBe(
      "",
    );
  });
});
