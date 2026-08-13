// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
  usePathname: mocks.usePathname,
}));

import { AdminNavigation } from "@/components/admin/AdminNavigation";

afterEach(() => {
  cleanup();
  mocks.usePathname.mockReset();
});

const props = {
  label: "Administration",
  overviewLabel: "Overview",
  teacherApplicationsLabel: "Teacher applications",
};

describe("AdminNavigation", () => {
  it("marks overview as current only on the admin overview route", () => {
    mocks.usePathname.mockReturnValue("/admin");
    render(<AdminNavigation {...props} />);

    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Teacher applications" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks the teacher application queue as current on its route", () => {
    mocks.usePathname.mockReturnValue("/admin/teacher-applications");
    render(<AdminNavigation {...props} />);

    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(
      screen.getByRole("link", { name: "Teacher applications" }),
    ).toHaveAttribute("aria-current", "page");
  });
});
