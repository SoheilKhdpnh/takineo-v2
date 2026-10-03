// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from "react";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import faMessages from "@/messages/fa.json";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children?: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { SessionWrapUp } from "@/components/live-session/SessionWrapUp";
import {
  wrapUpReasonForDisconnect,
  type WrapUpReason,
} from "@/components/live-session/session-join-model";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ review: null }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderWrapUp(
  reason: WrapUpReason,
  onRejoin = vi.fn(),
  viewerRole: "STUDENT" | "TEACHER" = "STUDENT",
) {
  render(
    <SessionWrapUp
      brand="Talkinu"
      sessionId="session-1"
      viewerRole={viewerRole}
      counterpartName="Sara"
      reason={reason}
      onSubmitReview={vi.fn()}
      onRejoin={onRejoin}
    />,
  );

  return onRejoin;
}

describe("wrapUpReasonForDisconnect", () => {
  const endAt = "2026-10-03T16:15:00.000Z";
  const endMs = new Date(endAt).getTime();

  it("offers rejoin for a drop before the session ends", () => {
    expect(wrapUpReasonForDisconnect(endAt, endMs - 1)).toBe("disconnected");
  });

  it("treats a drop at or after endAt as the normal end of the session", () => {
    expect(wrapUpReasonForDisconnect(endAt, endMs)).toBe("time");
    expect(wrapUpReasonForDisconnect(endAt, endMs + 60_000)).toBe("time");
  });
});

describe("SessionWrapUp after a connection drop", () => {
  it("offers rejoin without the end-of-session rating prompt", async () => {
    const onRejoin = renderWrapUp("disconnected");

    expect(
      screen.getByRole("heading", { name: "wrapUp.disconnectedTitle" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("wrapUp.rateTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("wrapUp.reportSoon")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "wrapUp.rejoin" }),
    );

    expect(onRejoin).toHaveBeenCalledTimes(1);
  });

  it.each(["leave", "time", "completed", "cancelled"] as const)(
    "does not offer rejoin when the session ended by %s",
    (reason) => {
      renderWrapUp(reason);

      expect(
        screen.queryByRole("button", { name: "wrapUp.rejoin" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "wrapUp.title" }),
      ).toBeInTheDocument();
    },
  );

  it("still prompts the student to rate after a normal end", () => {
    renderWrapUp("time");

    expect(screen.getByText("wrapUp.rateTitle")).toBeInTheDocument();
  });

  it("keeps EN/FA wrap-up copy in parity", () => {
    expect(Object.keys(faMessages.LiveSessionJoin.wrapUp).sort()).toEqual(
      Object.keys(enMessages.LiveSessionJoin.wrapUp).sort(),
    );
  });
});
