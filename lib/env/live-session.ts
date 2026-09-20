import "server-only";

import { z } from "zod";

import {
  createLiveSessionEvidenceTimingPolicy,
  type LiveSessionEvidenceTimingPolicy,
} from "@/lib/domain/live-session/policy";
import {
  LiveSessionConfigurationError,
} from "@/lib/errors/live-session-errors";

export {
  LiveSessionConfigurationError,
};

/*
 * Env values are decimal millisecond strings. Coercion is deliberately
 * avoided: an absent or blank variable must not collapse to 0.
 */
const nonNegativeSafeIntegerMsSchema = z
  .string()
  .regex(
    /^[0-9]+$/,
    "Live-session grace environment values must be decimal milliseconds.",
  )
  .transform(
    (value) => Number(value),
  )
  .refine(
    (value) => Number.isSafeInteger(value) && value >= 0,
    {
      message:
        "Live-session grace environment values must be non-negative safe integers.",
    },
  );

const liveSessionTimingEnvironmentSchema = z.object({
  LIVE_SESSION_REJOIN_GRACE_MS:
    nonNegativeSafeIntegerMsSchema,
  LIVE_SESSION_EVIDENCE_HORIZON_GRACE_MS:
    nonNegativeSafeIntegerMsSchema,
});

const liveSessionWebhookSecretSchema = z
  .string()
  .min(
    32,
    "LIVE_SESSION_WEBHOOK_SECRET must contain at least 32 characters.",
  );

export function getLiveSessionTimingPolicy(): LiveSessionEvidenceTimingPolicy {
  const parsed = liveSessionTimingEnvironmentSchema.safeParse({
    LIVE_SESSION_REJOIN_GRACE_MS:
      process.env.LIVE_SESSION_REJOIN_GRACE_MS,
    LIVE_SESSION_EVIDENCE_HORIZON_GRACE_MS:
      process.env.LIVE_SESSION_EVIDENCE_HORIZON_GRACE_MS,
  });

  if (!parsed.success) {
    throw new LiveSessionConfigurationError(
      "LIVE_SESSION_REJOIN_GRACE_MS and LIVE_SESSION_EVIDENCE_HORIZON_GRACE_MS must be configured as non-negative safe integer milliseconds.",
    );
  }

  return createLiveSessionEvidenceTimingPolicy({
    rejoinGraceMs:
      parsed.data.LIVE_SESSION_REJOIN_GRACE_MS,
    evidenceHorizonGraceMs:
      parsed.data.LIVE_SESSION_EVIDENCE_HORIZON_GRACE_MS,
  });
}

export function getLiveSessionWebhookSecret(): string {
  const parsed = liveSessionWebhookSecretSchema.safeParse(
    process.env.LIVE_SESSION_WEBHOOK_SECRET,
  );

  if (!parsed.success) {
    throw new LiveSessionConfigurationError(
      "LIVE_SESSION_WEBHOOK_SECRET is not configured.",
    );
  }

  return parsed.data;
}

export const LIVE_SESSION_PROVIDERS = [
  "fake",
  "livekit",
] as const;

export type LiveSessionProviderName =
  (typeof LIVE_SESSION_PROVIDERS)[number];

export type LiveKitLiveSessionConfig = Readonly<{
  apiKey: string;
  apiSecret: string;
  wsUrl: string;
  httpUrl: string;
}>;

const liveSessionProviderNameSchema = z.enum(
  LIVE_SESSION_PROVIDERS,
);

const liveKitApiKeySchema = z
  .string()
  .min(1, "LIVEKIT_API_KEY is required.")
  .refine(
    (value) => value === value.trim() && !/\s/.test(value),
    {
      message: "LIVEKIT_API_KEY must not contain whitespace.",
    },
  );

const liveKitApiSecretSchema = z
  .string()
  .min(1, "LIVEKIT_API_SECRET is required.")
  .refine(
    (value) => value === value.trim() && !/\s/.test(value),
    {
      message: "LIVEKIT_API_SECRET must not contain whitespace.",
    },
  );

const liveKitWsUrlSchema = z
  .string()
  .url("LIVEKIT_WS_URL must be a valid URL.")
  .refine(
    (value) =>
      value.startsWith("ws://") || value.startsWith("wss://"),
    {
      message: "LIVEKIT_WS_URL must be a ws:// or wss:// URL.",
    },
  );

const liveKitHttpUrlSchema = z
  .string()
  .url("LIVEKIT_HTTP_URL must be a valid URL.")
  .refine(
    (value) =>
      value.startsWith("http://") || value.startsWith("https://"),
    {
      message: "LIVEKIT_HTTP_URL must be an http:// or https:// URL.",
    },
  );

function httpUrlFromWebSocketUrl(
  wsUrl: string,
): string {
  if (wsUrl.startsWith("wss://")) {
    return `https://${wsUrl.slice("wss://".length)}`;
  }

  return `http://${wsUrl.slice("ws://".length)}`;
}

export function getLiveSessionProviderName(): LiveSessionProviderName {
  const parsed = liveSessionProviderNameSchema.safeParse(
    process.env.LIVE_SESSION_PROVIDER,
  );

  if (!parsed.success) {
    throw new LiveSessionConfigurationError(
      "LIVE_SESSION_PROVIDER must be configured as fake or livekit.",
    );
  }

  return parsed.data;
}

export function getLiveKitLiveSessionConfig(): LiveKitLiveSessionConfig {
  const apiKey = liveKitApiKeySchema.safeParse(
    process.env.LIVEKIT_API_KEY,
  );
  const apiSecret = liveKitApiSecretSchema.safeParse(
    process.env.LIVEKIT_API_SECRET,
  );
  const wsUrl = liveKitWsUrlSchema.safeParse(
    process.env.LIVEKIT_WS_URL,
  );

  if (!apiKey.success || !apiSecret.success || !wsUrl.success) {
    throw new LiveSessionConfigurationError(
      "LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_WS_URL must be configured for the LiveKit live-session provider.",
    );
  }

  const configuredHttpUrl = process.env.LIVEKIT_HTTP_URL;
  const httpUrl = liveKitHttpUrlSchema.safeParse(
    configuredHttpUrl === undefined || configuredHttpUrl.length === 0
      ? httpUrlFromWebSocketUrl(wsUrl.data)
      : configuredHttpUrl,
  );

  if (!httpUrl.success) {
    throw new LiveSessionConfigurationError(
      "LIVEKIT_HTTP_URL must be an http:// or https:// URL when set.",
    );
  }

  return {
    apiKey: apiKey.data,
    apiSecret: apiSecret.data,
    wsUrl: wsUrl.data,
    httpUrl: httpUrl.data,
  };
}
