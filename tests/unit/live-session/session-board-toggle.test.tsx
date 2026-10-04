// @vitest-environment jsdom

import { createRef } from "react";

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import faMessages from "@/messages/fa.json";

vi.mock("@/components/live-session/whiteboard/SessionWhiteboard", () => ({
  SessionWhiteboard: ({
    locale,
    canDraw,
    canClear,
  }: {
    locale: string;
    canDraw: boolean;
    canClear: boolean;
  }) => (
    <div
      data-testid="whiteboard"
      data-locale={locale}
      data-can-draw={String(canDraw)}
      data-can-clear={String(canClear)}
    />
  ),
}));

import { SessionInCall } from "@/components/live-session/SessionInCall";
import { WhiteboardHub } from "@/components/live-session/whiteboard/whiteboard-hub";

const board = enMessages.LiveSessionJoin.board;

afterEach(() => {
  cleanup();
});

function renderCall(
  locale: "en" | "fa" = "en",
  viewerRole: "TEACHER" | "STUDENT" = "TEACHER",
  hub = new WhiteboardHub(viewerRole),
) {
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? enMessages : faMessages}
    >
      <SessionInCall
        selfName="Amir"
        selfImage={null}
        counterpartName="Sara"
        counterpartImage={null}
        remotePresent
        localSpeaking={false}
        remoteSpeaking={false}
        quality="good"
        reconnecting={false}
        muted={false}
        videoEnabled={false}
        videoDegraded={false}
        endAt={new Date(Date.now() + 10 * 60_000).toISOString()}
        localVideoRef={createRef<HTMLVideoElement>()}
        remoteVideoRef={createRef<HTMLVideoElement>()}
        onToggleMute={vi.fn()}
        onToggleVideo={vi.fn()}
        onLeave={vi.fn()}
        onElapsed={vi.fn()}
        chatMessages={[]}
        remoteChatTotal={0}
        onSendChat={vi.fn().mockResolvedValue(true)}
        whiteboardHub={hub}
        viewerRole={viewerRole}
      />
    </NextIntlClientProvider>,
  );

  return hub;
}

describe("SessionInCall whiteboard entry point", () => {
  it("does not load the whiteboard until it is opened", () => {
    renderCall();

    expect(screen.queryByTestId("whiteboard")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: board.open }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("opens the board as the main area and closes it again", async () => {
    const user = userEvent.setup();
    renderCall();

    await user.click(screen.getByRole("button", { name: board.open }));

    expect(await screen.findByTestId("whiteboard")).toHaveAttribute(
      "data-locale",
      "en",
    );
    expect(screen.getByRole("region", { name: board.title })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: board.close }));

    expect(screen.queryByTestId("whiteboard")).not.toBeInTheDocument();
  });

  it("lets the teacher draw and grant or revoke student drawing", async () => {
    const user = userEvent.setup();
    const hub = renderCall("en", "TEACHER");

    await user.click(screen.getByRole("button", { name: board.open }));
    const canvas = await screen.findByTestId("whiteboard");

    expect(canvas).toHaveAttribute("data-can-draw", "true");
    expect(canvas).toHaveAttribute("data-can-clear", "true");
    expect(screen.getByText(board.teacherOnlyYou)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: board.allowStudent }));

    expect(hub.isStudentDrawingAllowed()).toBe(true);
    expect(screen.getByText(board.teacherStudentCanDraw)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: board.revokeStudent }));

    expect(hub.isStudentDrawingAllowed()).toBe(false);
  });

  it("keeps the student view-only with no permission control until the teacher grants access", async () => {
    const user = userEvent.setup();
    const hub = renderCall("en", "STUDENT");

    await user.click(screen.getByRole("button", { name: board.open }));
    const canvas = await screen.findByTestId("whiteboard");

    expect(canvas).toHaveAttribute("data-can-draw", "false");
    expect(canvas).toHaveAttribute("data-can-clear", "false");
    expect(screen.getByText(board.studentViewOnly)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: board.allowStudent }),
    ).not.toBeInTheDocument();

    act(() => {
      hub.receive(JSON.stringify({ kind: "permission", studentCanDraw: true }));
    });

    expect(screen.getByTestId("whiteboard")).toHaveAttribute("data-can-draw", "true");
    expect(screen.getByText(board.studentCanDraw)).toBeInTheDocument();
  });

  it("passes the Persian locale through to the board", async () => {
    const user = userEvent.setup();
    renderCall("fa");

    await user.click(
      screen.getByRole("button", { name: faMessages.LiveSessionJoin.board.open }),
    );

    expect(await screen.findByTestId("whiteboard")).toHaveAttribute(
      "data-locale",
      "fa",
    );
  });

  it("keeps EN/FA board copy in parity", () => {
    expect(Object.keys(faMessages.LiveSessionJoin.board).sort()).toEqual(
      Object.keys(enMessages.LiveSessionJoin.board).sort(),
    );
  });
});
