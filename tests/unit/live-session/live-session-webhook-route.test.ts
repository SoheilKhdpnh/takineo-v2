import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  getLiveSessionProvider: vi.fn(),
  ingestLiveSessionProviderEvent: vi.fn(),
}));

vi.mock("@/lib/live-session/provider", () => ({
  getLiveSessionProvider: mocks.getLiveSessionProvider,
}));

vi.mock("@/lib/services/live-session-webhook.service", () => ({
  ingestLiveSessionProviderEvent: mocks.ingestLiveSessionProviderEvent,
}));

import {
  POST as ingestWebhook,
} from "@/app/api/webhooks/live-session/route";
import {
  LiveSessionUnknownSessionError,
} from "@/lib/errors/live-session-errors";
import {
  createFakeLiveSessionProvider,
  FAKE_LIVE_SESSION_SIGNATURE_HEADER,
} from "@/lib/live-session/fake-provider";

const SECRET = "s".repeat(32);
const rawBody = JSON.stringify({
  providerEventRef: "evt-1",
  sessionId: "session-1",
  type: "ROOM_ENDED",
  occurredAt: "2026-08-20T10:15:00.000Z",
});

function signedRequest(signature?: string) {
  const provider = createFakeLiveSessionProvider({
    webhookSecret: SECRET,
  });

  return new Request("http://localhost:3000/api/webhooks/live-session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [FAKE_LIVE_SESSION_SIGNATURE_HEADER]:
        signature ?? provider.signWebhookBody(rawBody),
    },
    body: rawBody,
  });
}

describe("live-session webhook route", () => {
  beforeEach(() => {
    mocks.getLiveSessionProvider.mockReturnValue(
      createFakeLiveSessionProvider({ webhookSecret: SECRET }),
    );
    mocks.ingestLiveSessionProviderEvent.mockResolvedValue({
      ingested: true,
      duplicate: false,
    });
  });

  it("rejects an invalid signature before ingestion", async () => {
    const response = await ingestWebhook(signedRequest("00".repeat(32)));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_WEBHOOK_SIGNATURE",
    });
    expect(mocks.ingestLiveSessionProviderEvent).not.toHaveBeenCalled();
  });

  it("rejects events for an unknown session", async () => {
    mocks.ingestLiveSessionProviderEvent.mockRejectedValue(
      new LiveSessionUnknownSessionError(),
    );

    const response = await ingestWebhook(signedRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "UNKNOWN_LIVE_SESSION",
    });
  });

  it("acknowledges duplicate delivery after a unique conflict no-op", async () => {
    mocks.ingestLiveSessionProviderEvent.mockResolvedValue({
      ingested: false,
      duplicate: true,
    });

    const response = await ingestWebhook(signedRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      duplicate: true,
    });
  });
});
