// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminReviewPlayback } from "@/components/admin/AdminReviewPlayback";

const applicationId = "ck12345678901234567890123";
const playbackToken = "signed-token-value";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

const copy = {
  description: "Request short-lived playback.",
  start: "Load private playback",
  refresh: "Request fresh playback",
  loading: "Requesting private playback…",
  active: "Private playback is active.",
  expiresSoon: "It expires soon.",
  expired: "Playback expired.",
  unavailableState: "Playback is unavailable for this state.",
  unauthorized: "Session unavailable.",
  forbidden: "Admin access revoked.",
  conflict: "Review state changed.",
  unavailable: "Playback provider unavailable.",
  genericError: "Playback failed.",
  playerTitle: "Private teacher introduction video",
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AdminReviewPlayback", () => {
  it("keeps playback unavailable when the server-rendered review snapshot is ineligible", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(
      <AdminReviewPlayback
        applicationId={applicationId}
        enabled={false}
        copy={copy}
      />,
    );

    expect(screen.getByText(copy.unavailableState)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests an on-demand signed grant and mounts only the private Mux player URL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        playback: {
          playbackId: "signed-playback-id",
          token: playbackToken,
          expiresInSeconds: 300,
        },
      }),
    );

    render(
      <AdminReviewPlayback
        applicationId={applicationId}
        enabled
        copy={copy}
      />,
    );

    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: copy.start }),
    );

    const player = await screen.findByTitle(copy.playerTitle);
    const src = new URL(player.getAttribute("src") ?? "");

    expect(src.origin).toBe("https://player.mux.com");
    expect(src.pathname).toBe("/signed-playback-id");
    expect(src.searchParams.get("playback-token")).toBe(playbackToken);
    expect(src.searchParams.get("preload")).toBe("metadata");
    expect(src.searchParams.get("disable-cookies")).toBe("true");
    expect(player).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(screen.queryByText(playbackToken)).not.toBeInTheDocument();
    expect(screen.getByText(copy.active, { exact: false })).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(requestUrl).toBe(
      `/api/admin/teacher-applications/${applicationId}/playback`,
    );
    expect(requestInit).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    expect(requestInit).not.toHaveProperty("body");
  });

  it("maps a review conflict without exposing a stale player", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "REVIEW_STATE_CONFLICT" }, 409),
    );

    render(
      <AdminReviewPlayback
        applicationId={applicationId}
        enabled
        copy={copy}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: copy.start }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(copy.conflict);
    expect(screen.queryByTitle(copy.playerTitle)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: copy.refresh }),
    ).toBeInTheDocument();
  });

  it("removes the player when the short-lived playback grant expires", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        playback: {
          playbackId: "signed-playback-id",
          token: playbackToken,
          expiresInSeconds: 1,
        },
      }),
    );

    render(
      <AdminReviewPlayback
        applicationId={applicationId}
        enabled
        copy={copy}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: copy.start }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTitle(copy.playerTitle)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByTitle(copy.playerTitle)).not.toBeInTheDocument();
    expect(screen.getByText(copy.expired)).toBeInTheDocument();
  });
});
