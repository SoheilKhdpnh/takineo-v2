import {
  describe,
  expect,
  it,
} from "vitest";

import {
  liveSessionJoinErrorMessageKey,
} from "@/components/live-session/join-errors";
import enMessages from "@/messages/en.json";
import faMessages from "@/messages/fa.json";

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
    expect(Object.keys(faMessages.LiveSessionJoin.errors).sort()).toEqual(
      Object.keys(enMessages.LiveSessionJoin.errors).sort(),
    );
  });
});
