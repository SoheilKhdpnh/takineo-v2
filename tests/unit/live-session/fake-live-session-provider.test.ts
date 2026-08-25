import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  LiveSessionCredentialGrant,
} from "@/lib/domain/live-session/provider";
import {
  LiveSessionInvalidWebhookSignatureError,
  LiveSessionMalformedEventError,
} from "@/lib/errors/live-session-errors";
import {
  createFakeLiveSessionProvider,
  FAKE_LIVE_SESSION_SIGNATURE_HEADER,
} from "@/lib/live-session/fake-provider";

const SECRET = "s".repeat(32);

function grant(): LiveSessionCredentialGrant {
  return {
    grantId: "grant-1",
    sessionId: "session-1",
    clientJoinAttemptId: "attempt-1",
    participantUserId: "student-user",
    participantRole: "STUDENT",
    providerParticipantRef: "fake-ppr:one",
    authorizedAt: new Date("2026-08-20T10:00:00.000Z"),
  };
}

describe("fake live-session provider", () => {
  it("keeps provider participant refs distinct from Takineo user ids", () => {
    const provider = createFakeLiveSessionProvider({
      webhookSecret: SECRET,
    });

    const ref = provider.allocateProviderParticipantRef();

    expect(ref).not.toBe("student-user");
    expect(ref).toMatch(/^fake-ppr:/);
    expect(ref).not.toBe(provider.allocateProviderParticipantRef());
  });

  it("treats credential expiration as distinct from explicit revocation", async () => {
    const provider = createFakeLiveSessionProvider({
      webhookSecret: SECRET,
      now: () => new Date("2026-08-20T10:00:00.000Z"),
      credentialTtlMs: 60_000,
    });

    const issued = await provider.issueCredential({ grant: grant() });

    expect(issued.expiresAt).toEqual(
      new Date("2026-08-20T10:01:00.000Z"),
    );
    expect(provider.revokedGrantIds.size).toBe(0);

    await provider.revokeCredential({
      grantId: "grant-1",
      providerParticipantRef: "fake-ppr:one",
    });

    expect(provider.revokedGrantIds.has("grant-1")).toBe(true);
  });

  it("accepts a signature-verified webhook body and rejects a forged one", () => {
    const provider = createFakeLiveSessionProvider({
      webhookSecret: SECRET,
    });
    const rawBody = JSON.stringify({
      providerEventRef: "evt-1",
      sessionId: "session-1",
      type: "ROOM_ENDED",
      occurredAt: "2026-08-20T10:15:00.000Z",
    });

    const accepted = provider.verifyAndParseWebhook(
      rawBody,
      new Headers({
        [FAKE_LIVE_SESSION_SIGNATURE_HEADER]:
          provider.signWebhookBody(rawBody),
      }),
    );

    expect(accepted.type).toBe("ROOM_ENDED");

    expect(() =>
      provider.verifyAndParseWebhook(
        rawBody,
        new Headers({
          [FAKE_LIVE_SESSION_SIGNATURE_HEADER]: "ab".repeat(32),
        }),
      ),
    ).toThrow(LiveSessionInvalidWebhookSignatureError);
  });

  it("rejects a signed but malformed webhook body", () => {
    const provider = createFakeLiveSessionProvider({
      webhookSecret: SECRET,
    });
    const rawBody = JSON.stringify({
      providerEventRef: "evt-1",
      sessionId: "session-1",
      type: "ROOM_ENDED",
      occurredAt: "2026-08-20T10:15:00.000Z",
      providerParticipantRef: "should-not-be-present",
    });

    expect(() =>
      provider.verifyAndParseWebhook(
        rawBody,
        new Headers({
          [FAKE_LIVE_SESSION_SIGNATURE_HEADER]:
            provider.signWebhookBody(rawBody),
        }),
      ),
    ).toThrow(LiveSessionMalformedEventError);
  });
});
