import "server-only";

import { randomUUID } from "node:crypto";

import {
  AccessToken,
  WebhookReceiver,
} from "livekit-server-sdk";

import {
  BOOKING_SESSION_MINUTES,
} from "@/lib/domain/booking-policy";
import type {
  LiveKitLiveSessionConfig,
} from "@/lib/env/live-session";
import {
  LiveSessionInvalidWebhookSignatureError,
  LiveSessionMalformedEventError,
} from "@/lib/errors/live-session-errors";
import {
  mapLiveKitWebhookEvent,
} from "@/lib/live-session/livekit-webhook";
import {
  speakingSessionRoomName,
} from "@/lib/live-session/room-name";
import type {
  LiveSessionRuntimeProvider,
} from "@/lib/live-session/runtime";

export type LiveKitWebhookReceiver = Readonly<{
  receive: (
    body: string,
    authHeader?: string,
  ) => Promise<unknown>;
}>;

export type LiveKitLiveSessionProviderOptions =
  LiveKitLiveSessionConfig &
  Readonly<{
    now?: () => Date;
    credentialTtlMs?: number;
    webhookReceiver?: LiveKitWebhookReceiver;
  }>;

function readLiveKitAuthHeader(
  headers: Headers,
): string | undefined {
  const raw = headers.get("authorization");

  if (!raw) {
    return undefined;
  }

  if (raw.startsWith("Bearer ") || raw.startsWith("bearer ")) {
    return raw.slice(7);
  }

  return raw;
}

function defaultWebhookReceiver(
  config: LiveKitLiveSessionConfig,
): LiveKitWebhookReceiver {
  const receiver = new WebhookReceiver(
    config.apiKey,
    config.apiSecret,
  );

  return {
    receive(body, authHeader) {
      return receiver.receive(body, authHeader);
    },
  };
}

export function createLiveKitLiveSessionProvider(
  options: LiveKitLiveSessionProviderOptions,
): LiveSessionRuntimeProvider {
  const credentialTtlMs =
    options.credentialTtlMs ??
    BOOKING_SESSION_MINUTES * 60 * 1000;
  const now = options.now ?? (() => new Date());
  const webhookReceiver =
    options.webhookReceiver ??
    defaultWebhookReceiver(options);

  return {
    allocateProviderParticipantRef() {
      return `lkppr_${randomUUID()}`;
    },

    getJoinUrl() {
      return options.wsUrl;
    },

    async verifyAndParseWebhook(rawBody, headers) {
      const authHeader = readLiveKitAuthHeader(headers);

      try {
        await webhookReceiver.receive(
          rawBody,
          authHeader,
        );
      } catch {
        throw new LiveSessionInvalidWebhookSignatureError();
      }

      let parsedJson: unknown;

      try {
        parsedJson = JSON.parse(rawBody);
      } catch {
        throw new LiveSessionMalformedEventError();
      }

      return mapLiveKitWebhookEvent(parsedJson);
    },

    async issueCredential(command) {
      const issuedAt = now();
      const expiresAt = new Date(
        issuedAt.getTime() + credentialTtlMs,
      );
      const ttlSeconds = Math.max(
        1,
        Math.ceil(credentialTtlMs / 1000),
      );
      const token = new AccessToken(
        options.apiKey,
        options.apiSecret,
        {
          identity: command.grant.providerParticipantRef,
          ttl: ttlSeconds,
          name: command.grant.participantRole,
        },
      );

      token.addGrant({
        roomJoin: true,
        room: speakingSessionRoomName(command.grant.sessionId),
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      return {
        credential: await token.toJwt(),
        expiresAt,
      };
    },

    async revokeCredential(command) {
      void command;
      /*
       * The frozen revocation command carries grantId and
       * providerParticipantRef, not sessionId. LiveKit RemoveParticipant
       * needs the room name, which is derived from sessionId. No service
       * calls revoke yet; this stays a documented no-op rather than
       * treating grantId as a room name.
       */
    },
  };
}
