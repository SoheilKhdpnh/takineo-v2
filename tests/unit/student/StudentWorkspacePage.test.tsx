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
  getStudentProfileForUser: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock("@/lib/auth/page-guards", () => ({
  requireRolePage: mocks.requireRolePage,
}));

vi.mock("@/lib/services/student-profile.service", () => ({
  getStudentProfileForUser: mocks.getStudentProfileForUser,
}));

vi.mock("@/components/profiles/StudentProfileForm", () => ({
  StudentProfileForm: () => <div data-testid="student-profile-form" />,
}));

vi.mock("@/components/student/StudentProfileOverview", () => ({
  StudentProfileOverview: ({
    children,
    profile,
  }: {
    children?: ReactNode;
    profile: { englishLevel: string | null; learningGoal: string | null };
  }) => (
    <div
      data-testid="student-profile-overview"
      data-level={profile.englishLevel ?? ""}
    >
      <p>{profile.learningGoal}</p>
      {children}
    </div>
  ),
}));

vi.mock("@/components/sessions/UpcomingSessionsPanel", () => ({
  UpcomingSessionsPanel: () => <div data-testid="upcoming-sessions" />,
}));

vi.mock("@/components/teachers/TeacherDiscoveryPanel", () => ({
  TeacherDiscoveryPanel: () => <div data-testid="teacher-discovery" />,
}));

vi.mock("@/components/student/StudentAiChatPanel", () => ({
  StudentAiChatPanel: () => <div data-testid="student-ai-chat" />,
}));

import StudentDashboardPage from "@/app/[locale]/student/dashboard/page";
import StudentProfilePage from "@/app/[locale]/student/profile/page";

const baseProfile = {
  id: "student-profile",
  userId: "student-user",
  englishLevel: "A2" as const,
  learningGoal: "Travel and work abroad",
  nativeLanguage: "fa" as const,
  timezone: "Asia/Tehran" as const,
  profileCompletedAt: new Date("2026-04-01T08:00:00.000Z"),
  createdAt: new Date("2026-04-01T08:00:00.000Z"),
  updatedAt: new Date("2026-04-01T08:00:00.000Z"),
};

beforeEach(() => {
  mocks.getTranslations.mockReset();
  mocks.setRequestLocale.mockReset();
  mocks.requireRolePage.mockReset();
  mocks.getStudentProfileForUser.mockReset();

  mocks.getTranslations.mockResolvedValue((key: string) => key);
  mocks.requireRolePage.mockResolvedValue({
    session: { user: { id: "student-user", name: "Ali Reza", image: null } },
  });
  mocks.getStudentProfileForUser.mockResolvedValue(baseProfile);
});

afterEach(() => {
  cleanup();
});

describe("student workspace profile", () => {
  it("shows the setup form until the learner profile is complete", async () => {
    mocks.getStudentProfileForUser.mockResolvedValue({
      ...baseProfile,
      profileCompletedAt: null,
    });

    const page = await StudentProfilePage({
      params: Promise.resolve({ locale: "en" }),
    });

    render(page);

    expect(screen.getByTestId("student-profile-form")).toBeInTheDocument();
    expect(
      screen.queryByTestId("student-profile-overview"),
    ).not.toBeInTheDocument();
  });

  it("renders the overview workspace with sessions and discovery when complete", async () => {
    const page = await StudentProfilePage({
      params: Promise.resolve({ locale: "fa" }),
    });

    render(page);

    expect(mocks.requireRolePage).toHaveBeenCalledWith("STUDENT", "fa");
    expect(screen.getByTestId("student-profile-overview")).toHaveAttribute(
      "data-level",
      "A2",
    );
    expect(screen.getByText("Travel and work abroad")).toBeInTheDocument();
    expect(screen.getByTestId("upcoming-sessions")).toBeInTheDocument();
    expect(screen.getByTestId("student-ai-chat")).toBeInTheDocument();
    expect(screen.getByTestId("teacher-discovery")).toBeInTheDocument();
  });

  it("keeps the dashboard route on the same workspace page", async () => {
    const page = await StudentDashboardPage({
      params: Promise.resolve({ locale: "en" }),
    });

    render(page);

    expect(screen.getByTestId("student-profile-overview")).toBeInTheDocument();
  });

  it("keeps EN/FA StudentProfile and StudentWorkspace catalogs in parity", () => {
    expect(Object.keys(faMessages.StudentProfile).sort()).toEqual(
      Object.keys(enMessages.StudentProfile).sort(),
    );
    expect(Object.keys(faMessages.StudentWorkspace).sort()).toEqual(
      Object.keys(enMessages.StudentWorkspace).sort(),
    );
    expect(Object.keys(faMessages.StudentProfile.levels).sort()).toEqual(
      Object.keys(enMessages.StudentProfile.levels).sort(),
    );
    expect(Object.keys(faMessages.StudentProfile.skills).sort()).toEqual(
      Object.keys(enMessages.StudentProfile.skills).sort(),
    );
    expect(Object.keys(faMessages.StudentWorkspace.nav).sort()).toEqual(
      Object.keys(enMessages.StudentWorkspace.nav).sort(),
    );
    expect(Object.keys(faMessages.StudentAiChat).sort()).toEqual(
      Object.keys(enMessages.StudentAiChat).sort(),
    );
  });
});
