import type { ReactElement } from "react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
  requireAdminPageAccess: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock("@/lib/auth/admin-page-guard", () => ({
  requireAdminPageAccess:
    mocks.requireAdminPageAccess,
}));

vi.mock("@/components/admin/AdminShell", () => ({
  AdminShell: () => null,
}));

import AdminLayout from "@/app/[locale]/admin/layout";

const translations: Record<string, string> = {
  skipToContent: "Skip",
  brand: "Takineo",
  workspace: "Admin workspace",
  navigationLabel: "Administration",
  overview: "Overview",
  teacherApplications: "Teacher applications",
  signedInAs: "Signed in as",
  permissionLabel: "Access level",
  reviewerPermission: "Reviewer",
  superAdminPermission: "Super admin",
};

describe("admin layout", () => {
  beforeEach(() => {
    mocks.getTranslations.mockReset();
    mocks.setRequestLocale.mockReset();
    mocks.requireAdminPageAccess.mockReset();

    mocks.getTranslations.mockResolvedValue(
      (key: string) => translations[key] ?? key,
    );

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
  });

  it.each(["fa", "en"] as const)(
    "protects the localized %s admin surface with the centralized server page guard",
    async (locale) => {
      const child = <div>Protected content</div>;
      const result = (await AdminLayout({
        children: child,
        params: Promise.resolve({ locale }),
      })) as ReactElement<{
        administratorName: string;
        permission: string;
        children: ReactElement;
      }>;

      expect(
        mocks.setRequestLocale,
      ).toHaveBeenCalledWith(locale);
      expect(
        mocks.requireAdminPageAccess,
      ).toHaveBeenCalledOnce();
      expect(
        mocks.requireAdminPageAccess,
      ).toHaveBeenCalledWith(locale);
      expect(
        mocks.getTranslations,
      ).toHaveBeenCalledWith({
        locale,
        namespace: "AdminShell",
      });

      expect(result.props).toMatchObject({
        administratorName: "Admin User",
        permission: "REVIEWER",
      });
      expect(result.props.children).toBe(child);
    },
  );
});
