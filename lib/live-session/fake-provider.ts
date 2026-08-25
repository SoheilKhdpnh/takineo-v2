import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  BOOKING_SESSION_MINUTES,
} from "@/lib/domain/booking-policy";
import type {
  LiveSessionProviderAdapter,
  LiveSessionProviderEvidenceEvent,
} from "@/lib/domain/live-session/provider";
import {
  LiveSessionInvalidWebhookSignatureError,
  LiveSessionMalformedEventError,
} from "@/lib/errors/live-session-errors";
import {
  liveSessionProviderWebhookEventSchema,
} from "@/lib/validations/live-session";

export const FAKE_LIVE_SESSION_SIGNATURE_HEADER =
  "x-takineo-live-session-signature";

export type FakeLiveSessionProviderOptions = Readonly<{
  webhookSecret: string;
  now?: () => Date;
  credentialTtlMs?: number;
}>;

export type FakeLiveSessionProvider =
  LiveSessionProviderAdapter &
  Readonly<{
    allocateProviderParticipantRef: () => string;
    signWebhookBody: (rawBody: string) => string;
    verifyAndParseWebhook: (
      rawBody: string,
      headers: Headers,
    ) => LiveSessionProviderEvidenceEvent;
    revokedGrantIds: ReadonlySet<string>;
  }>;

function hmacHex(
  secret: string,
  rawBody: string,
): string {
  return createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
}

function signaturesMatch(
  provided: string,
  expected: string,
): boolean {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);

  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

export function createFakeLiveSessionProvider(
  options: FakeLiveSessionProviderOptions,
): FakeLiveSessionProvider {
  const revokedGrantIds = new Set<string>();
  const credentialTtlMs =
    options.credentialTtlMs ??
    BOOKING_SESSION_MINUTES * 60 * 1000;
  const now = options.now ?? (() => new Date());

  return {
    allocateProviderParticipantRef() {
      return `fake-ppr:${randomUUID()}`;
    },

    signWebhookBody(rawBody) {
      return hmacHex(options.webhookSecret, rawBody);
    },

    verifyAndParseWebhook(rawBody, headers) {
      const provided =
        headers.get(FAKE_LIVE_SESSION_SIGNATURE_HEADER) ?? "";
      const expected = hmacHex(options.webhookSecret, rawBody);

      if (!signaturesMatch(provided, expected)) {
        throw new LiveSessionInvalidWebhookSignatureError();
      }

      let parsedJson: unknown;

      try {
        parsedJson = JSON.parse(rawBody);
      } catch {
        throw new LiveSessionMalformedEventError();
      }

      const parsed =
        liveSessionProviderWebhookEventSchema.safeParse(parsedJson);

      if (!parsed.success) {
        throw new LiveSessionMalformedEventError();
      }

      return parsed.data;
    },

    async issueCredential(command) {
      const issuedAt = now();

      return {
        credential: `fake-live:${command.grant.grantId}:${randomUUID()}`,
        expiresAt: new Date(issuedAt.getTime() + credentialTtlMs),
      };
    },

    async revokeCredential(command) {
      revokedGrantIds.add(command.grantId);
    },

    get revokedGrantIds() {
      return new Set(revokedGrantIds);
    },
  };
}
