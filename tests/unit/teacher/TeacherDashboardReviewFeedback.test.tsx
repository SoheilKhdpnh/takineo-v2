// @vitest-environment jsdom

import type { AnchorHTMLAttributes } from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
}));

vi.mock("@/components/auth/SignOutButton", () => ({
  SignOutButton: () => null,
}));

vi.mock("@/components/sessions/UpcomingSessionsPanel", () => ({
  UpcomingSessionsPanel: () => (
    <div data-testid="upcoming-sessions" />
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

const profile = {
  id: "teacher-profile",
  userId: "teacher-user",
  headline: "Experienced English teacher",
  bio: "Teacher biography",
  experienceYears: 6,
  nativeLanguage: "Persian",
  teachingLanguage: "English",
  timezone: "Asia/Tehran",
  profileCompletedAt: new Date("2026-08-01T08:00:00.000Z"),
  applicationStatus: "REJECTED" as const,
  applicationSubmittedAt: new Date("2026-08-10T08:00:00.000Z"),
  applicationReviewedAt: new Date("2026-08-11T08:00:00.000Z"),
  applicationReviewNote: "Clarify the experience section before resubmitting.",
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
        applicationStatus: "REJECTED",
        profileCompletedAt: profile.profileCompletedAt,
        introVideo: { id: "video-id", status: "APPROVED", durationSeconds: 84 },
      },
    },
  });
  mocks.getTeacherProfileForUser.mockResolvedValue(profile);
  mocks.redirect.mockImplementation(() => {
    throw new Error("REDIRECT");
  });
});

afterEach(() => {
  cleanup();
});

describe("teacher dashboard rejection feedback", () => {
  it("loads the sanitized applicant profile record and passes only the review note into the submit workspace", async () => {
    const page = await TeacherDashboardPage({
      params: Promise.resolve({ locale: "en" }),
    });

    render(page);

    expect(mocks.requireRolePage).toHaveBeenCalledWith("TEACHER", "en");
    expect(mocks.getTeacherProfileForUser).toHaveBeenCalledWith("teacher-user");
    expect(screen.getByTestId("application-submit")).toHaveAttribute(
      "data-status",
      "REJECTED",
    );
    expect(screen.getByTestId("application-submit")).toHaveAttribute(
      "data-feedback",
      profile.applicationReviewNote,
    );
  });

  it("still redirects an incomplete teacher profile before rendering applicant feedback", async () => {
    mocks.getTeacherProfileForUser.mockResolvedValue({
      ...profile,
      profileCompletedAt: null,
    });

    await expect(
      TeacherDashboardPage({
        params: Promise.resolve({ locale: "fa" }),
      }),
    ).rejects.toThrow("REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith({
      href: "/teacher/profile",
      locale: "fa",
    });
  });
});
