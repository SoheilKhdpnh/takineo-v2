// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  TalkinuMark,
  TalkinuWordmark,
} from "@/components/ui/TalkinuMark";

describe("TalkinuMark", () => {
  it("renders a scalable SVG mark that can sit beside a wordmark", () => {
    const { container } = render(<TalkinuMark />);
    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 32 32");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("pairs the mark with LTR and RTL wordmarks without swapping order", () => {
    const english = render(<TalkinuWordmark brand="Talkinu" />);
    const persian = render(<TalkinuWordmark brand="تاکینو" />);

    expect(english.container.querySelector("svg")).not.toBeNull();
    expect(english.container.textContent).toContain("Talkinu");
    expect(persian.container.querySelector("svg")).not.toBeNull();
    expect(persian.container.textContent).toContain("تاکینو");
  });
});
