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
