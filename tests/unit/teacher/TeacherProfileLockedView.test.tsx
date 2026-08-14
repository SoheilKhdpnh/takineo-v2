// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TeacherProfileLockedView } from "@/components/profiles/TeacherProfileLockedView";

const fields = [
  { label: "Headline", value: "English speaking coach" },
  {
    label: "Biography",
    value: "A detailed teaching biography.",
    multiline: true,
  },
  { label: "Time zone", value: "Asia/Tehran", dir: "ltr" as const },
];

afterEach(() => {
  cleanup();
});

describe("TeacherProfileLockedView", () => {
  it("renders a named read-only profile snapshot without edit controls", () => {
    render(
      <TeacherProfileLockedView
        eyebrow="Teacher profile"
        title="Your teaching profile is read-only"
        statusLabel="Under review"
        description="Editing is locked during review."
        snapshotLabel="Reviewed profile"
        footnote="Changes reopen only after Takineo requests them."
        fields={fields}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Your teaching profile is read-only",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Under review")).toBeInTheDocument();
    expect(screen.getByText("English speaking coach")).toBeInTheDocument();
    expect(screen.getByText("Asia/Tehran")).toHaveAttribute("dir", "ltr");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
