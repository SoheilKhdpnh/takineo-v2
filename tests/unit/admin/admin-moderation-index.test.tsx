// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

import { AdminModerationIndex } from "@/components/admin/AdminModerationIndex";

const copy = {
  approvedTab: "Approved",
  suspendedTab: "Suspended",
  emptyApprovedTitle: "No approved teachers found",
  emptyApprovedDescription: "No approved teachers here.",
  emptySuspendedTitle: "No suspended teachers found",
  emptySuspendedDescription: "No suspended teachers here.",
  approvedStatus: "Approved",
  suspendedStatus: "Suspended",
  headlineLabel: "Headline",
  accountLabel: "Account",
  reviewedLabel: "Last reviewed",
  reviewCycleLabel: "Review cycle",
  updatedLabel: "Last updated",
  noHeadline: "No professional headline",
  noReviewDate: "Unavailable",
  accountActive: "Active",
  accountSuspended: "Suspended account",
  accountDisabled: "Disabled",
  openTeacher: "Open teacher record",
  nextPage: "Next page",
  endOfList: "End of list",
};

const approvedTeacher = {
  id: "ck12345678901234567890123",
  headline: "Speaking coach",
  applicationStatus: "APPROVED" as const,
  applicationReviewedAt: new Date("2026-08-13T10:00:00.000Z"),
  reviewCycle: 2,
  updatedAt: new Date("2026-08-13T11:00:00.000Z"),
  user: {
    name: "Approved Teacher",
    email: "approved@example.com",
    accountStatus: "ACTIVE" as const,
  },
};

afterEach(() => {
  cleanup();
});

describe("AdminModerationIndex", () => {
  it("renders approved teacher context and links back to the existing teacher record", () => {
    render(
      <AdminModerationIndex
        teachers={[approvedTeacher]}
        status="APPROVED"
        nextCursor={null}
        formatDate={() => "Aug 13, 2026"}
        copy={copy}
      />,
    );

    expect(screen.getByRole("link", { name: "Approved" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Suspended" }),
    ).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Approved Teacher")).toBeInTheDocument();
    expect(screen.getByText("approved@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("Speaking coach").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: "Open teacher record" }),
    ).toHaveAttribute(
      "href",
      "/admin/teacher-applications/ck12345678901234567890123",
    );
    expect(screen.getByText("End of list")).toBeInTheDocument();
  });

  it("preserves the selected moderation state in cursor pagination", () => {
    render(
      <AdminModerationIndex
        teachers={[
          {
            ...approvedTeacher,
            applicationStatus: "SUSPENDED",
          },
        ]}
        status="SUSPENDED"
        nextCursor="ck22345678901234567890123"
        formatDate={() => "Aug 13, 2026"}
        copy={copy}
      />,
    );

    expect(screen.getByRole("link", { name: "Suspended" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/admin/teachers?status=SUSPENDED&cursor=ck22345678901234567890123",
    );
  });

  it("renders a status-specific empty state without inventing teacher records", () => {
    render(
      <AdminModerationIndex
        teachers={[]}
        status="SUSPENDED"
        nextCursor={null}
        formatDate={() => "Aug 13, 2026"}
        copy={copy}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No suspended teachers found" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open teacher record" }),
    ).not.toBeInTheDocument();
  });
});
