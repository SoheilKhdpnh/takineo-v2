// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { SessionLobby } from "@/components/live-session/SessionLobby";
import { SessionWrapUp } from "@/components/live-session/SessionWrapUp";
import { liveSessionJoinErrorMessageKey } from "@/components/live-session/join-errors";
import { parseJoinSuccess } from "@/components/live-session/session-join-model";
import enMessages from "@/messages/en.json";
import faMessages from "@/messages/fa.json";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ review: null }),
    }),
  );
});

describe("live-session join error mapping", () => {
  it("maps stable join denial codes onto message keys", () => {
    expect(liveSessionJoinErrorMessageKey("JOIN_NOT_PARTICIPANT")).toBe(
      "errors.notParticipant",
    );
    expect(liveSessionJoinErrorMessageKey("JOIN_WINDOW_CLOSED")).toBe(
      "errors.windowClosed",
    );
    expect(liveSessionJoinErrorMessageKey("UNKNOWN")).toBe("errors.generic");
  });

  it("keeps join copy in Persian and English catalog parity", () => {
    expect(Object.keys(faMessages.LiveSessionJoin).sort()).toEqual(
      Object.keys(enMessages.LiveSessionJoin).sort(),
    );
    expect(Object.keys(faMessages.LiveSessionJoin.lobby).sort()).toEqual(
      Object.keys(enMessages.LiveSessionJoin.lobby).sort(),
    );
    expect(Object.keys(faMessages.LiveSessionJoin.call).sort()).toEqual(
      Object.keys(enMessages.LiveSessionJoin.call).sort(),
    );
    expect(Object.keys(faMessages.LiveSessionJoin.wrapUp).sort()).toEqual(
      Object.keys(enMessages.LiveSessionJoin.wrapUp).sort(),
    );
    expect(Object.keys(faMessages.LiveSessionJoin.errors).sort()).toEqual(
      Object.keys(enMessages.LiveSessionJoin.errors).sort(),
    );
  });

  it("accepts only websocket join URLs from the existing credential payload", () => {
    expect(
      parseJoinSuccess({
        credential: "token",
        url: "wss://livekit.example/rtc",
      }),
    ).toEqual({
      credential: "token",
      url: "wss://livekit.example/rtc",
    });
    expect(
      parseJoinSuccess({
        credential: "token",
        url: "http://127.0.0.1:7880",
      }),
    ).toBeNull();
  });
});

describe("session lobby", () => {
  it("shows counterpart context, a mic meter, and a single join action", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SessionLobby
          brand="Talkinu"
          counterpartName="Sasan"
          counterpartImage={null}
          startAt="2026-09-20T10:00:00.000Z"
          endAt="2026-09-20T10:15:00.000Z"
          waitingToStart={false}
          errorMessage={null}
          busy={false}
          videoEnabled={false}
          onVideoEnabledChange={vi.fn()}
          audioInputs={[{ deviceId: "mic-1", label: "Built-in mic" }]}
          videoInputs={[]}
          audioDeviceId="mic-1"
          videoDeviceId=""
          onAudioDeviceIdChange={vi.fn()}
          onVideoDeviceIdChange={vi.fn()}
          micPermission="granted"
          meterFillRef={{ current: null }}
          previewStream={null}
          onJoin={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    expect(
      screen.getByRole("heading", {
        name: "You are about to meet Sasan",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(enMessages.LiveSessionJoin.lobby.micMeterLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: enMessages.LiveSessionJoin.lobby.join,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(enMessages.LiveSessionJoin.lobby.deviceCamera),
    ).not.toBeInTheDocument();
  });
});

describe("session wrap-up", () => {
  it("lets a student skip the rating without submitting", async () => {
    const user = userEvent.setup();
    const onSubmitReview = vi.fn();

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SessionWrapUp
          brand="Talkinu"
          sessionId="session-1"
          viewerRole="STUDENT"
          counterpartName="Sasan"
          reason="leave"
          onSubmitReview={onSubmitReview}
        />
      </NextIntlClientProvider>,
    );

    expect(
      screen.getByText(enMessages.LiveSessionJoin.wrapUp.reportSoon),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: enMessages.LiveSessionJoin.wrapUp.skip,
      }),
    );

    expect(onSubmitReview).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", {
        name: enMessages.LiveSessionJoin.wrapUp.backToDashboard,
      }),
    ).toBeInTheDocument();
  });

  it("does not prompt a teacher to rate the student", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SessionWrapUp
          brand="Talkinu"
          sessionId="session-1"
          viewerRole="TEACHER"
          counterpartName="Leila"
          reason="time"
          onSubmitReview={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });
});
