import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  LiveSessionConfigurationError,
  getLiveSessionTimingPolicy,
  getLiveSessionWebhookSecret,
} from "@/lib/env/live-session";

const originalRejoin = process.env.LIVE_SESSION_REJOIN_GRACE_MS;
const originalHorizon = process.env.LIVE_SESSION_EVIDENCE_HORIZON_GRACE_MS;
const originalSecret = process.env.LIVE_SESSION_WEBHOOK_SECRET;

afterEach(() => {
  if (originalRejoin === undefined) {
    delete process.env.LIVE_SESSION_REJOIN_GRACE_MS;
  } else {
    process.env.LIVE_SESSION_REJOIN_GRACE_MS = originalRejoin;
  }

  if (originalHorizon === undefined) {
    delete process.env.LIVE_SESSION_EVIDENCE_HORIZON_GRACE_MS;
  } else {
    process.env.LIVE_SESSION_EVIDENCE_HORIZON_GRACE_MS = originalHorizon;
  }

  if (originalSecret === undefined) {
    delete process.env.LIVE_SESSION_WEBHOOK_SECRET;
  } else {
    process.env.LIVE_SESSION_WEBHOOK_SECRET = originalSecret;
  }
});

describe("live-session environment", () => {
  it("fails closed when grace environment values are absent", () => {
    delete process.env.LIVE_SESSION_REJOIN_GRACE_MS;
    delete process.env.LIVE_SESSION_EVIDENCE_HORIZON_GRACE_MS;

    expect(() => getLiveSessionTimingPolicy()).toThrow(
      LiveSessionConfigurationError,
    );
  });

  it("does not coerce a blank grace value to zero", () => {
    process.env.LIVE_SESSION_REJOIN_GRACE_MS = "";
    process.env.LIVE_SESSION_EVIDENCE_HORIZON_GRACE_MS = "60000";

    expect(() => getLiveSessionTimingPolicy()).toThrow(
      LiveSessionConfigurationError,
    );
  });

  it("rejects negative grace strings instead of inventing a default", () => {
    process.env.LIVE_SESSION_REJOIN_GRACE_MS = "-1";
    process.env.LIVE_SESSION_EVIDENCE_HORIZON_GRACE_MS = "60000";

    expect(() => getLiveSessionTimingPolicy()).toThrow(
      LiveSessionConfigurationError,
    );
  });

  it("accepts explicit zero without treating it as a missing default", () => {
    process.env.LIVE_SESSION_REJOIN_GRACE_MS = "0";
    process.env.LIVE_SESSION_EVIDENCE_HORIZON_GRACE_MS = "0";

    expect(getLiveSessionTimingPolicy()).toEqual({
      rejoinGraceMs: 0,
      evidenceHorizonGraceMs: 0,
    });
  });

  it("keeps the two grace policies independent when both are configured", () => {
    process.env.LIVE_SESSION_REJOIN_GRACE_MS = "120000";
    process.env.LIVE_SESSION_EVIDENCE_HORIZON_GRACE_MS = "300000";

    expect(getLiveSessionTimingPolicy()).toEqual({
      rejoinGraceMs: 120000,
      evidenceHorizonGraceMs: 300000,
    });
  });

  it("fails closed when the webhook secret is absent", () => {
    delete process.env.LIVE_SESSION_WEBHOOK_SECRET;

    expect(() => getLiveSessionWebhookSecret()).toThrow(
      LiveSessionConfigurationError,
    );
  });
});
