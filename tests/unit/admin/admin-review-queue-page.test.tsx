import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
  requireAdminPageAccess: vi.fn(),
  listPendingTeacherApplications: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock("@/lib/auth/admin-page-guard", () => ({
  requireAdminPageAccess: mocks.requireAdminPageAccess,
}));

vi.mock("@/lib/services/admin-review.service", () => ({
  listPendingTeacherApplications: mocks.listPendingTeacherApplications,
}));

vi.mock("@/components/admin/AdminReviewQueue", () => ({
  AdminReviewQueue: () => null,
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: mocks.redirect,
}));

import AdminTeacherApplicationsPage from "@/app/[locale]/admin/teacher-applications/page";

describe("admin teacher application queue page", () => {
  beforeEach(() => {
    mocks.getTranslations.mockReset();
    mocks.setRequestLocale.mockReset();
    mocks.requireAdminPageAccess.mockReset();
    mocks.listPendingTeacherApplications.mockReset();
    mocks.redirect.mockReset();

    mocks.getTranslations.mockResolvedValue((key: string) => key);
    mocks.requireAdminPageAccess.mockResolvedValue({
      session: {
        user: {
          id: "admin-user",
          name: "Admin User",
        },
      },
      admin: {
        permission: "REVIEWER",
      },
    });
    mocks.listPendingTeacherApplications.mockResolvedValue({
      applications: [],
      nextCursor: null,
    });
    mocks.redirect.mockImplementation(() => {
      throw new Error("REDIRECT");
    });
  });

  it("authorizes server-side and loads a bounded cursor page through the existing service", async () => {
    const cursor = "ck12345678901234567890123";
    const result = (await AdminTeacherApplicationsPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ cursor }),
    })) as ReactElement;

    expect(mocks.setRequestLocale).toHaveBeenCalledWith("en");
    expect(mocks.requireAdminPageAccess).toHaveBeenCalledWith("en");
    expect(mocks.listPendingTeacherApplications).toHaveBeenCalledWith(
      "admin-user",
      {
        cursor,
        limit: 20,
      },
    );
    expect(mocks.getTranslations).toHaveBeenCalledWith({
      locale: "en",
      namespace: "AdminReviewQueue",
    });
    expect(result.type).toBe("section");
  });

  it("rejects an invalid cursor before loading queue data", async () => {
    await expect(
      AdminTeacherApplicationsPage({
        params: Promise.resolve({ locale: "fa" }),
        searchParams: Promise.resolve({ cursor: "not-a-cuid" }),
      }),
    ).rejects.toThrow("REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith({
      href: "/admin/teacher-applications",
      locale: "fa",
    });
    expect(mocks.requireAdminPageAccess).toHaveBeenCalledWith("fa");
    expect(mocks.listPendingTeacherApplications).not.toHaveBeenCalled();
  });
});
