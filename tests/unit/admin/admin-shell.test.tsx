// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  }) => <a href={href} {...props} />,
  usePathname: () => "/admin",
}));

vi.mock("@/components/auth/SignOutButton", () => ({
  SignOutButton: () => (
    <button type="button">Sign out</button>
  ),
}));

import { AdminShell } from "@/components/admin/AdminShell";

afterEach(() => {
  cleanup();
});

const copy = {
  skipToContent: "Skip to admin content",
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

describe("AdminShell", () => {
  it.each([
    ["REVIEWER", "Reviewer"],
    ["SUPER_ADMIN", "Super admin"],
  ] as const)(
    "renders an accessible operational shell for %s access",
    (permission, expectedPermissionLabel) => {
      render(
        <AdminShell
          administratorName="Admin User"
          permission={permission}
          copy={copy}
        >
          <h1>Overview heading</h1>
        </AdminShell>,
      );

      expect(
        screen.getByRole("navigation", {
          name: "Administration",
        }),
      ).toBeInTheDocument();

      expect(
        screen.getByRole("link", {
          name: "Overview",
        }),
      ).toHaveAttribute("aria-current", "page");

      expect(
        screen.getByRole("main"),
      ).toHaveAttribute("id", "admin-main");

      expect(
        screen.getByRole("link", {
          name: "Skip to admin content",
        }),
      ).toHaveAttribute("href", "#admin-main");

      expect(
        screen.getByText("Admin User"),
      ).toBeInTheDocument();

      expect(
        screen.getAllByText(
          expectedPermissionLabel,
        ).length,
      ).toBeGreaterThan(0);

      expect(
        screen.getByRole("heading", {
          name: "Overview heading",
        }),
      ).toBeInTheDocument();
    },
  );
});
