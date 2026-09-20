import { createHash } from "node:crypto";

import {
  AccessToken,
} from "livekit-server-sdk";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  LiveSessionInvalidWebhookSignatureError,
} from "@/lib/errors/live-session-errors";
import {
  createLiveKitLiveSessionProvider,
} from "@/lib/live-session/livekit-provider";
import {
  speakingSessionRoomName,
} from "@/lib/live-session/room-name";
import type {
  LiveSessionCredentialGrant,
} from "@/lib/domain/live-session/provider";

const CONFIG = {
  apiKey: "APItestkey",
  apiSecret: "test-livekit-secret-value-32chars!",
  wsUrl: "ws://127.0.0.1:7880",
  httpUrl: "http://127.0.0.1:7880",
} as const;

function grant(): LiveSessionCredentialGrant {
  return {
    grantId: "grant-1",
    sessionId: "session-1",
    clientJoinAttemptId: "attempt-1",
    participantUserId: "student-user",
    participantRole: "STUDENT",
    providerParticipantRef: "lkppr_one",
    authorizedAt: new Date("2026-08-20T10:00:00.000Z"),
  };
}

function decodeJwtPayload(
  token: string,
): Record<string, unknown> {
  const parts = token.split(".");

  expect(parts.length).toBe(3);

  return JSON.parse(
    Buffer.from(parts[1] ?? "", "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

describe("LiveKit live-session provider", () => {
  it("allocates opaque LiveKit participant refs distinct from Takineo user ids", () => {
    const provider = createLiveKitLiveSessionProvider(CONFIG);
    const ref = provider.allocateProviderParticipantRef();

    expect(ref).not.toBe("student-user");
    expect(ref).toMatch(/^lkppr_/);
    expect(ref).not.toBe(provider.allocateProviderParticipantRef());
  });

  it("issues a LiveKit AccessToken bound to the grant identity and session room", async () => {
    const provider = createLiveKitLiveSessionProvider({
      ...CONFIG,
      now: () => new Date("2026-08-20T10:00:00.000Z"),
    });

    const issued = await provider.issueCredential({
      grant: grant(),
    });

    expect(issued.expiresAt).toEqual(
      new Date("2026-08-20T10:15:00.000Z"),
    );
    expect(provider.getJoinUrl()).toBe("ws://127.0.0.1:7880");

    const payload = decodeJwtPayload(issued.credential);

    expect(payload.sub).toBe("lkppr_one");
    expect(payload.iss).toBe(CONFIG.apiKey);
    expect(payload.video).toMatchObject({
      roomJoin: true,
      room: speakingSessionRoomName("session-1"),
      canPublish: true,
      canSubscribe: true,
    });
  });

  it("maps a signature-verified LiveKit webhook body into evidence", async () => {
    const rawBody = JSON.stringify({
      event: "room_finished",
      id: "EV_room_1",
      createdAt: 1_787_216_400,
      room: {
        name: speakingSessionRoomName("session-1"),
      },
    });
    const provider = createLiveKitLiveSessionProvider({
      ...CONFIG,
      webhookReceiver: {
        async receive() {
          return {};
        },
      },
    });

    const mapped = await provider.verifyAndParseWebhook(
      rawBody,
      new Headers({
        authorization: "Bearer verified",
      }),
    );

    expect(mapped).toMatchObject({
      type: "ROOM_ENDED",
      providerEventRef: "EV_room_1",
      sessionId: "session-1",
    });
  });

  it("rejects an unverified LiveKit webhook before mapping", async () => {
    const provider = createLiveKitLiveSessionProvider({
      ...CONFIG,
      webhookReceiver: {
        async receive() {
          throw new Error("unauthorized");
        },
      },
    });

    await expect(
      provider.verifyAndParseWebhook(
        "{}",
        new Headers(),
      ),
    ).rejects.toBeInstanceOf(LiveSessionInvalidWebhookSignatureError);
  });

  it("verifies a real LiveKit webhook JWT against the posted body", async () => {
    const rawBody = JSON.stringify({
      event: "participant_joined",
      id: "EV_join_1",
      createdAt: 1_787_216_400,
      room: {
        sid: "RM_1",
        name: speakingSessionRoomName("session-1"),
      },
      participant: {
        sid: "PA_conn_a",
        identity: "lkppr_one",
      },
    });
    const token = new AccessToken(CONFIG.apiKey, CONFIG.apiSecret);
    token.sha256 = createHash("sha256")
      .update(rawBody)
      .digest("base64");
    const provider = createLiveKitLiveSessionProvider(CONFIG);

    const mapped = await provider.verifyAndParseWebhook(
      rawBody,
      new Headers({
        authorization: await token.toJwt(),
      }),
    );

    expect(mapped).toMatchObject({
      type: "PARTICIPANT_CONNECTED",
      providerEventRef: "EV_join_1",
      providerParticipantRef: "lkppr_one",
      connectionRef: "PA_conn_a",
    });

    const forged = new AccessToken(CONFIG.apiKey, "other-livekit-secret-value-32ch");
    forged.sha256 = createHash("sha256")
      .update(rawBody)
      .digest("base64");

    await expect(
      provider.verifyAndParseWebhook(
        rawBody,
        new Headers({
          authorization: await forged.toJwt(),
        }),
      ),
    ).rejects.toBeInstanceOf(LiveSessionInvalidWebhookSignatureError);
  });
});
