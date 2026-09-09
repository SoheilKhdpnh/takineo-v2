// @vitest-environment jsdom

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

import TeacherProfilePage from "@/app/[locale]/teacher/profile/page";

const teacherProfileCopy = {
  eyebrow: "Teacher profile",
  title: "Create your professional teaching profile",
  description: "Editable profile description",
  headline: "Professional headline",
  bio: "Professional biography",
  experienceYears: "Years of teaching experience",
  lockedTitle: "Your teaching profile is read-only",
  lockedPendingDescription: "Pending lock copy",
  lockedApprovedDescription: "Approved lock copy",
  lockedSuspendedDescription: "Suspended lock copy",
  statusPendingReview: "Under review",
  statusApproved: "Approved",
  statusSuspended: "Suspended",
  profileSnapshot: "Reviewed profile",
  notProvided: "Not provided",
  lockedPendingFootnote: "Pending unlock guidance",
  lockedApprovedFootnote: "Approved lock guidance",
  lockedSuspendedFootnote: "Suspended lock guidance",
};

const profileCommonCopy = {
  nativeLanguage: "Native language",
  timezone: "Time zone",
  "languages.fa": "Persian",
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
      const dictionaries: Record<
        string,
        Record<string, string>
      > = {
        TeacherProfile: teacherProfileCopy,
        ProfileCommon: profileCommonCopy,
      };

      return (key: string) =>
        dictionaries[namespace]?.[key] ?? key;
    },
  );

  mocks.requireRolePage.mockResolvedValue({
    session: { user: { id: "teacher-user" } },
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
) {
  mocks.getTeacherProfileForUser.mockResolvedValue({
    ...baseProfile,
    applicationStatus,
  });

  const page = await TeacherProfilePage({
    params: Promise.resolve({ locale: "en" }),
  });

  render(page);
}

describe("teacher profile lifecycle lock", () => {
  it.each(["DRAFT", "REJECTED"] as const)(
    "keeps %s applications editable",
    async (status) => {
      await renderStatus(status);

      expect(screen.getByTestId("teacher-profile-form")).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", {
          name: teacherProfileCopy.lockedTitle,
        }),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    ["PENDING_REVIEW", teacherProfileCopy.statusPendingReview, teacherProfileCopy.lockedPendingDescription],
    ["APPROVED", teacherProfileCopy.statusApproved, teacherProfileCopy.lockedApprovedDescription],
    ["SUSPENDED", teacherProfileCopy.statusSuspended, teacherProfileCopy.lockedSuspendedDescription],
  ] as const)(
    "renders %s as a server-side read-only profile snapshot",
    async (status, statusLabel, description) => {
      await renderStatus(status);

      expect(
        screen.getByRole("heading", {
          name: teacherProfileCopy.lockedTitle,
        }),
      ).toBeInTheDocument();
      expect(screen.getByText(statusLabel)).toBeInTheDocument();
      expect(screen.getByText(description)).toBeInTheDocument();
      expect(screen.getByText(baseProfile.headline)).toBeInTheDocument();
      expect(screen.getByText(baseProfile.bio)).toBeInTheDocument();
      expect(screen.getByText("Persian")).toBeInTheDocument();
      expect(screen.getByText("Asia/Tehran")).toHaveAttribute("dir", "ltr");
      expect(screen.queryByTestId("teacher-profile-form")).not.toBeInTheDocument();
    },
  );

  it("loads the profile only after the teacher page guard and keeps EN/FA lock copy in parity", async () => {
    await renderStatus("PENDING_REVIEW");

    expect(mocks.requireRolePage).toHaveBeenCalledWith("TEACHER", "en");
    expect(mocks.getTeacherProfileForUser).toHaveBeenCalledWith("teacher-user");

    expect(Object.keys(faMessages.TeacherProfile).sort()).toEqual(
      Object.keys(enMessages.TeacherProfile).sort(),
    );
    expect(enMessages.TeacherProfile.lockedTitle.trim()).not.toBe("");
    expect(faMessages.TeacherProfile.lockedTitle.trim()).not.toBe("");
  });
});
