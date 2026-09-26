// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    alt,
    priority,
    ...props
  }: {
    alt: string;
    priority?: boolean;
    src: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} data-priority={priority ? "true" : undefined} {...props} />
  ),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
  }: {
    href: string;
    children: ReactNode;
  }) => <a href={href}>{children}</a>,
}));

import { HomeHero } from "@/components/home/HomeHero";

describe("HomeHero", () => {
  it("keeps headline and CTAs on canvas, not over the photo", () => {
    const { container } = render(
      <HomeHero
        eyebrow="Talkinu"
        title="Speak English for 15 focused minutes with a real teacher"
        description="Teachers teach. AI analyzes."
        findTeacher="Find a teacher"
        createAccount="Create account"
        imageAlt="A learner speaking with a human teacher over a video call."
      />,
    );

    const heading = screen.getByRole("heading", { level: 1 });
    const image = screen.getByRole("img", {
      name: "A learner speaking with a human teacher over a video call.",
    });

    expect(heading.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector("h1")?.closest(".relative")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Find a teacher" })).toHaveAttribute(
      "href",
      "/teachers",
    );
    expect(image.getAttribute("data-priority")).toBe("true");
  });
});
