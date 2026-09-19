// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AdminReviewPlayback } from "@/components/admin/AdminReviewPlayback";

const copy = {
  description: "Watch the submitted Aparat video.",
  codeLabel: "Expected spoken code",
  spokenPhraseLabel: "Expected spoken phrase",
  spokenPhrase: "This video is recorded for the Talkinu team",
  playerTitle: "Teacher introduction video",
  unavailableState: "Playback is unavailable for this state.",
  publicHostNote: "This player embeds a public Aparat URL.",
};

const embedUrl =
  "https://www.aparat.com/video/video/embed/videohash/abcDE12/vt/frame";

afterEach(() => {
  cleanup();
});

describe("AdminReviewPlayback", () => {
  it("keeps playback unavailable when the review snapshot is ineligible", () => {
    render(
      <AdminReviewPlayback
        embedUrl={embedUrl}
        verificationCode="AB12C"
        enabled={false}
        copy={copy}
      />,
    );

    expect(screen.getByText(copy.unavailableState)).toBeInTheDocument();
    expect(screen.queryByTitle(copy.playerTitle)).not.toBeInTheDocument();
  });

  it("shows the expected code beside the Aparat embed", () => {
    render(
      <AdminReviewPlayback
        embedUrl={embedUrl}
        verificationCode="AB12C"
        enabled
        copy={copy}
      />,
    );

    expect(screen.getByText("AB12C")).toBeInTheDocument();
    expect(screen.getByText(copy.spokenPhrase)).toBeInTheDocument();

    const player = screen.getByTitle(copy.playerTitle);
    expect(player).toHaveAttribute("src", embedUrl);
    expect(new URL(player.getAttribute("src") ?? "").origin).toBe(
      "https://www.aparat.com",
    );
  });
});
