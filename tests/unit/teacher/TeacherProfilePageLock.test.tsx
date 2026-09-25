// @vitest-environment jsdom

import type { ReactNode } from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import faMessages from "@/messages/fa.json";

const mocks = vi.hoisted(() => ({
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
  requireRolePage: vi.fn(),
  getTeacherProfileForUser: vi.fn(),
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

vi.mock("@/components/profiles/TeacherProfileForm", () => ({
  TeacherProfileForm: () => <div data-testid="teacher-profile-form" />,
}));

vi.mock("@/components/teacher/TeacherProfileOverview", () => ({
  TeacherProfileOverview: ({
    showEditor,
    profile,
    children,
  }: {
    showEditor: boolean;
    profile: {
      headline: string | null;
      applicationStatus: string;
    };
    children?: ReactNode;
  }) => (
    <div
      data-testid="teacher-profile-overview"
      data-show-editor={String(showEditor)}
      data-status={profile.applicationStatus}
    >
      <p>{profile.headline}</p>
      {showEditor ? <div data-testid="teacher-profile-form" /> : null}
      {children}
    </div>
  ),
}));

vi.mock("@/components/sessions/UpcomingSessionsPanel", () => ({
  UpcomingSessionsPanel: () => <div data-testid="upcoming-sessions" />,
}));

vi.mock("@/components/availability/TeacherAvailabilityPanel", () => ({
  TeacherAvailabilityPanel: () => <div data-testid="teacher-availability" />,
}));

vi.mock("@/components/profiles/TeacherApplicationSubmit", () => ({
  TeacherApplicationSubmit: () => <div data-testid="application-submit" />,
}));

import TeacherDashboardPage from "@/app/[locale]/teacher/dashboard/page";
import TeacherProfilePage from "@/app/[locale]/teacher/profile/page";

const teacherProfileCopy = {
  eyebrow: "Teacher profile",
  title: "Create your professional teaching profile",
  description: "Editable profile description",
};

const baseProfile = {
  id: "teacher-profile",
  userId: "teacher-user",
  headline: "Speaking coach for intermediate learners",
  bio: "A detailed biography describing the teacher and their approach.",
  experienceYears: 7,
  nativeLanguage: "fa" as const,
  teachingLanguage: "en" as const,
  timezone: "Asia/Tehran" as const,
  profileCompletedAt: new Date("2026-08-01T08:00:00.000Z"),
  applicationStatus: "DRAFT" as const,
  applicationSubmittedAt: null,
  applicationReviewedAt: null,
  applicationReviewNote: null,
  profileRevision: 3,
  createdAt: new Date("2026-07-01T08:00:00.000Z"),
  updatedAt: new Date("2026-08-01T08:00:00.000Z"),
  introVideo: null,
};

beforeEach(() => {
  mocks.getTranslations.mockReset();
  mocks.setRequestLocale.mockReset();
  mocks.requireRolePage.mockReset();
  mocks.getTeacherProfileForUser.mockReset();

  mocks.getTranslations.mockImplementation(
    async ({ namespace }: { namespace: string }) => {
      if (namespace === "TeacherProfile") {
        return (key: string) =>
          teacherProfileCopy[key as keyof typeof teacherProfileCopy] ?? key;
      }

      return (key: string) => key;
    },
  );

  mocks.requireRolePage.mockResolvedValue({
    session: { user: { id: "teacher-user", name: "Soheil K." } },
  });
  mocks.getTeacherProfileForUser.mockResolvedValue(baseProfile);
});

afterEach(() => {
  cleanup();
});

async function renderStatus(
  applicationStatus:
    | "DRAFT"
    | "PENDING_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "SUSPENDED",
  profileCompletedAt: Date | null = baseProfile.profileCompletedAt,
) {
  mocks.getTeacherProfileForUser.mockResolvedValue({
    ...baseProfile,
    applicationStatus,
    profileCompletedAt,
  });

  const page = await TeacherProfilePage({
    params: Promise.resolve({ locale: "en" }),
  });

  render(page);
}

describe("teacher profile lifecycle lock", () => {
  it.each(["DRAFT", "REJECTED"] as const)(
    "keeps completed %s applications editable in the overview",
    async (status) => {
      await renderStatus(status);

      const overview = screen.getByTestId("teacher-profile-overview");
      expect(overview).toHaveAttribute("data-show-editor", "true");
      expect(screen.getByTestId("teacher-profile-form")).toBeInTheDocument();
      expect(screen.getByText(baseProfile.headline)).toBeInTheDocument();
    },
  );

  it("shows the setup form when an editable profile is still incomplete", async () => {
    await renderStatus("DRAFT", null);

    expect(screen.getByTestId("teacher-profile-form")).toBeInTheDocument();
    expect(
      screen.queryByTestId("teacher-profile-overview"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: teacherProfileCopy.title,
      }),
    ).toBeInTheDocument();
  });

  it.each([
    "PENDING_REVIEW",
    "APPROVED",
    "SUSPENDED",
  ] as const)(
    "renders %s as a read-only overview without the editor",
    async (status) => {
      await renderStatus(status);

      const overview = screen.getByTestId("teacher-profile-overview");
      expect(overview).toHaveAttribute("data-show-editor", "false");
      expect(overview).toHaveAttribute("data-status", status);
      expect(screen.getByText(baseProfile.headline)).toBeInTheDocument();
      expect(
        screen.queryByTestId("teacher-profile-form"),
      ).not.toBeInTheDocument();
    },
  );

  it.each(["DRAFT", "PENDING_REVIEW", "REJECTED", "SUSPENDED"] as const)(
    "keeps the schedule editor unavailable while %s",
    async (status) => {
      await renderStatus(status);

      expect(screen.queryByTestId("teacher-availability")).toBeNull();
      expect(screen.getByText("scheduleLockedTitle")).toBeInTheDocument();
    },
  );

  it("shows the schedule editor, sessions, and application status for approved teachers", async () => {
    await renderStatus("APPROVED");

    expect(screen.getByTestId("teacher-availability")).toBeInTheDocument();
    expect(screen.getByTestId("upcoming-sessions")).toBeInTheDocument();
    expect(screen.getByTestId("application-submit")).toBeInTheDocument();
  });

  it("renders the same workspace at the dashboard route", async () => {
    const page = await TeacherDashboardPage({
      params: Promise.resolve({ locale: "fa" }),
    });

    render(page);

    expect(mocks.requireRolePage).toHaveBeenCalledWith("TEACHER", "fa");
    expect(screen.getByTestId("teacher-profile-overview")).toBeInTheDocument();
  });

  it("loads the profile only after the teacher page guard and keeps EN/FA copy in parity", async () => {
    await renderStatus("PENDING_REVIEW");

    expect(mocks.requireRolePage).toHaveBeenCalledWith("TEACHER", "en");
    expect(mocks.getTeacherProfileForUser).toHaveBeenCalledWith("teacher-user");

    expect(Object.keys(faMessages.TeacherProfile).sort()).toEqual(
      Object.keys(enMessages.TeacherProfile).sort(),
    );
    expect(Object.keys(faMessages.TeacherWorkspace).sort()).toEqual(
      Object.keys(enMessages.TeacherWorkspace).sort(),
    );
    expect(enMessages.TeacherProfile.lockedTitle.trim()).not.toBe("");
    expect(faMessages.TeacherProfile.lockedTitle.trim()).not.toBe("");
  });
});
