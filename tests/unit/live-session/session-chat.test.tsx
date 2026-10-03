// @vitest-environment jsdom

import { createRef } from "react";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionChatPanel } from "@/components/live-session/SessionChatPanel";
import { SessionInCall } from "@/components/live-session/SessionInCall";
import {
  SESSION_CHAT_MAX_LENGTH,
  SESSION_CHAT_MAX_MESSAGES,
  appendChatMessage,
  normalizeIncomingChatText,
  normalizeOutgoingChatText,
  type SessionChatMessage,
} from "@/components/live-session/session-chat-model";
import enMessages from "@/messages/en.json";
import faMessages from "@/messages/fa.json";

const chat = enMessages.LiveSessionJoin.chat;

afterEach(() => {
  cleanup();
});

function message(
  id: string,
  author: SessionChatMessage["author"],
  text: string,
): SessionChatMessage {
  return { id, author, text, sentAt: 0 };
}

describe("session chat model", () => {
  it("trims outgoing text and rejects empty or over-length messages", () => {
    expect(normalizeOutgoingChatText("  hello  ")).toBe("hello");
    expect(normalizeOutgoingChatText("   ")).toBeNull();
    expect(
      normalizeOutgoingChatText("a".repeat(SESSION_CHAT_MAX_LENGTH + 1)),
    ).toBeNull();
    expect(
      normalizeOutgoingChatText("a".repeat(SESSION_CHAT_MAX_LENGTH)),
    ).toHaveLength(SESSION_CHAT_MAX_LENGTH);
  });

  it("drops empty incoming text and clamps oversized payloads from the counterpart", () => {
    expect(normalizeIncomingChatText(" \n ")).toBeNull();
    expect(
      normalizeIncomingChatText("b".repeat(SESSION_CHAT_MAX_LENGTH * 3)),
    ).toHaveLength(SESSION_CHAT_MAX_LENGTH);
  });

  it("keeps only the most recent messages in memory", () => {
    let list: SessionChatMessage[] = [];

    for (let index = 0; index < SESSION_CHAT_MAX_MESSAGES + 5; index += 1) {
      list = appendChatMessage(list, message(String(index), "remote", "hi"));
    }

    expect(list).toHaveLength(SESSION_CHAT_MAX_MESSAGES);
    expect(list[0]?.id).toBe("5");
  });
});

describe("SessionChatPanel", () => {
  function renderPanel(
    messages: SessionChatMessage[],
    onSend = vi.fn().mockResolvedValue(true),
  ) {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SessionChatPanel
          messages={messages}
          counterpartName="Sara"
          onSend={onSend}
          onClose={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    return onSend;
  }

  it("shows the ephemeral notice and an empty state", () => {
    renderPanel([]);

    expect(screen.getByText(chat.ephemeralNotice)).toBeInTheDocument();
    expect(screen.getByText(chat.empty)).toBeInTheDocument();
  });

  it("renders counterpart text as plain text with automatic direction", () => {
    renderPanel([
      message("1", "remote", "<b>سلام</b> hello"),
      message("2", "self", "Hi Sara"),
    ]);

    const log = screen.getByRole("log");
    const remote = within(log).getByText("<b>سلام</b> hello");

    expect(remote).toHaveAttribute("dir", "auto");
    expect(log.querySelector("b")).toBeNull();
    expect(within(log).getByText("Sara")).toBeInTheDocument();
    expect(within(log).getByText("You")).toBeInTheDocument();
  });

  it("sends trimmed text and clears the input after success", async () => {
    const user = userEvent.setup();
    const onSend = renderPanel([]);
    const input = screen.getByLabelText(chat.inputLabel);

    await user.type(input, "  pronunciation  ");
    await user.click(screen.getByRole("button", { name: chat.send }));

    expect(onSend).toHaveBeenCalledWith("pronunciation");
    expect(input).toHaveValue("");
  });

  it("keeps the draft and shows an error when sending fails", async () => {
    const user = userEvent.setup();
    renderPanel([], vi.fn().mockResolvedValue(false));
    const input = screen.getByLabelText(chat.inputLabel);

    await user.type(input, "vocabulary{Enter}");

    expect(screen.getByRole("alert")).toHaveTextContent(chat.sendError);
    expect(input).toHaveValue("vocabulary");
  });

  it("disables send for whitespace-only drafts", async () => {
    const user = userEvent.setup();
    renderPanel([]);

    await user.type(screen.getByLabelText(chat.inputLabel), "   ");

    expect(screen.getByRole("button", { name: chat.send })).toBeDisabled();
  });
});

describe("SessionInCall chat entry point", () => {
  function renderCall(remoteChatTotal: number, messages: SessionChatMessage[]) {
    const props = {
      selfName: "Amir",
      selfImage: null,
      counterpartName: "Sara",
      counterpartImage: null,
      remotePresent: true,
      localSpeaking: false,
      remoteSpeaking: false,
      quality: "good" as const,
      reconnecting: false,
      muted: false,
      videoEnabled: false,
      videoDegraded: false,
      endAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      localVideoRef: createRef<HTMLVideoElement>(),
      remoteVideoRef: createRef<HTMLVideoElement>(),
      onToggleMute: vi.fn(),
      onToggleVideo: vi.fn(),
      onLeave: vi.fn(),
      onElapsed: vi.fn(),
      chatMessages: messages,
      remoteChatTotal,
      onSendChat: vi.fn().mockResolvedValue(true),
    };

    const view = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SessionInCall {...props} />
      </NextIntlClientProvider>,
    );

    return { view, props };
  }

  it("announces unread messages and clears the count once chat is opened and closed", async () => {
    const user = userEvent.setup();
    const messages = [message("1", "remote", "hi"), message("2", "remote", "there")];
    const { view, props } = renderCall(2, messages);

    await user.click(
      screen.getByRole("button", { name: "Chat, 2 new messages" }),
    );

    expect(screen.getByRole("region", { name: chat.title })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: chat.close }));

    view.rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SessionInCall {...props} />
      </NextIntlClientProvider>,
    );

    expect(
      screen.getByRole("button", { name: chat.open }),
    ).toBeInTheDocument();
  });

  it("keeps EN/FA chat copy in parity", () => {
    expect(Object.keys(faMessages.LiveSessionJoin.chat).sort()).toEqual(
      Object.keys(enMessages.LiveSessionJoin.chat).sort(),
    );
  });
});
