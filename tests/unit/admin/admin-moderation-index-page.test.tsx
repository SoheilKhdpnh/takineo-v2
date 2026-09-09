import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
  requireAdminPageAccess: vi.fn(),
  listModeratableTeachers: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock("@/lib/auth/admin-page-guard", () => ({
  requireAdminPageAccess: mocks.requireAdminPageAccess,
}));

vi.mock("@/lib/services/admin-moderation.service", () => ({
  listModeratableTeachers: mocks.listModeratableTeachers,
}));

vi.mock("@/components/admin/AdminModerationIndex", () => ({
  AdminModerationIndex: () => null,
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: mocks.redirect,
}));

import AdminTeachersPage from "@/app/[locale]/admin/teachers/page";

const superAdminAccess = {
  session: {
    user: {
      id: "super-admin-user",
      name: "Super Admin",
    },
  },
  admin: {
    permission: "SUPER_ADMIN",
    capabilities: {
      reviewTeacherApplications: true,
      moderateTeachers: true,
      moderateAccounts: true,
      manageAdminAccess: true,
      manageSessions: true,
    },
  },
};

describe("admin teacher moderation index page", () => {
  beforeEach(() => {
    mocks.getTranslations.mockReset();
    mocks.setRequestLocale.mockReset();
    mocks.requireAdminPageAccess.mockReset();
    mocks.listModeratableTeachers.mockReset();
    mocks.redirect.mockReset();

    mocks.getTranslations.mockResolvedValue((key: string) => key);
    mocks.requireAdminPageAccess.mockResolvedValue(superAdminAccess);
    mocks.listModeratableTeachers.mockResolvedValue({
      teachers: [],
      nextCursor: null,
    });
    mocks.redirect.mockImplementation(() => {
      throw new Error("REDIRECT");
    });
  });

  it("authorizes SUPER_ADMIN server-side and loads an explicit moderation status page", async () => {
    const cursor = "ck12345678901234567890123";
    const result = (await AdminTeachersPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({
        status: "SUSPENDED",
        cursor,
      }),
    })) as ReactElement;

    expect(mocks.setRequestLocale).toHaveBeenCalledWith("en");
    expect(mocks.requireAdminPageAccess).toHaveBeenCalledWith("en");
    expect(mocks.listModeratableTeachers).toHaveBeenCalledWith(
      "super-admin-user",
      {
        status: "SUSPENDED",
        cursor,
        limit: 20,
      },
    );
    expect(mocks.getTranslations).toHaveBeenCalledWith({
      locale: "en",
      namespace: "AdminModerationIndex",
    });
    expect(result.type).toBe("section");
  });

  it("redirects a REVIEWER before moderation query validation or service access", async () => {
    mocks.requireAdminPageAccess.mockResolvedValue({
      ...superAdminAccess,
      admin: {
        permission: "REVIEWER",
        capabilities: {
          reviewTeacherApplications: true,
          moderateTeachers: false,
          moderateAccounts: false,
          manageAdminAccess: false,
          manageSessions: false,
        },
      },
    });

    await expect(
      AdminTeachersPage({
        params: Promise.resolve({ locale: "fa" }),
        searchParams: Promise.resolve({ status: "not-valid" }),
      }),
    ).rejects.toThrow("REDIRECT");

    expect(mocks.requireAdminPageAccess).toHaveBeenCalledWith("fa");
    expect(mocks.redirect).toHaveBeenCalledWith({
      href: "/admin",
      locale: "fa",
    });
    expect(mocks.listModeratableTeachers).not.toHaveBeenCalled();
  });

  it("canonicalizes missing or invalid moderation filters after authorization", async () => {
    await expect(
      AdminTeachersPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("REDIRECT");

    expect(mocks.requireAdminPageAccess).toHaveBeenCalledWith("en");
    expect(mocks.redirect).toHaveBeenCalledWith({
      href: "/admin/teachers?status=APPROVED",
      locale: "en",
    });
    expect(mocks.listModeratableTeachers).not.toHaveBeenCalled();
  });
});
