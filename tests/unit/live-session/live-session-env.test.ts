import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  LiveSessionConfigurationError,
  getLiveKitLiveSessionConfig,
  getLiveSessionProviderName,
  getLiveSessionTimingPolicy,
  getLiveSessionWebhookSecret,
} from "@/lib/env/live-session";

const originalRejoin = process.env.LIVE_SESSION_REJOIN_GRACE_MS;
const originalHorizon = process.env.LIVE_SESSION_EVIDENCE_HORIZON_GRACE_MS;
const originalSecret = process.env.LIVE_SESSION_WEBHOOK_SECRET;
const originalProvider = process.env.LIVE_SESSION_PROVIDER;
const originalLiveKitKey = process.env.LIVEKIT_API_KEY;
const originalLiveKitSecret = process.env.LIVEKIT_API_SECRET;
const originalLiveKitWs = process.env.LIVEKIT_WS_URL;
const originalLiveKitHttp = process.env.LIVEKIT_HTTP_URL;

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

  if (originalProvider === undefined) {
    delete process.env.LIVE_SESSION_PROVIDER;
  } else {
    process.env.LIVE_SESSION_PROVIDER = originalProvider;
  }

  if (originalLiveKitKey === undefined) {
    delete process.env.LIVEKIT_API_KEY;
  } else {
    process.env.LIVEKIT_API_KEY = originalLiveKitKey;
  }

  if (originalLiveKitSecret === undefined) {
    delete process.env.LIVEKIT_API_SECRET;
  } else {
    process.env.LIVEKIT_API_SECRET = originalLiveKitSecret;
  }

  if (originalLiveKitWs === undefined) {
    delete process.env.LIVEKIT_WS_URL;
  } else {
    process.env.LIVEKIT_WS_URL = originalLiveKitWs;
  }

  if (originalLiveKitHttp === undefined) {
    delete process.env.LIVEKIT_HTTP_URL;
  } else {
    process.env.LIVEKIT_HTTP_URL = originalLiveKitHttp;
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

  it("fails closed when the live-session provider name is absent", () => {
    delete process.env.LIVE_SESSION_PROVIDER;

    expect(() => getLiveSessionProviderName()).toThrow(
      LiveSessionConfigurationError,
    );
  });

  it("accepts fake and livekit as the only provider names", () => {
    process.env.LIVE_SESSION_PROVIDER = "fake";
    expect(getLiveSessionProviderName()).toBe("fake");

    process.env.LIVE_SESSION_PROVIDER = "livekit";
    expect(getLiveSessionProviderName()).toBe("livekit");

    process.env.LIVE_SESSION_PROVIDER = "mux";
    expect(() => getLiveSessionProviderName()).toThrow(
      LiveSessionConfigurationError,
    );
  });

  it("fails closed when LiveKit credentials are absent", () => {
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    delete process.env.LIVEKIT_WS_URL;

    expect(() => getLiveKitLiveSessionConfig()).toThrow(
      LiveSessionConfigurationError,
    );
  });

  it("derives the LiveKit HTTP URL from the websocket URL when unset", () => {
    process.env.LIVEKIT_API_KEY = "APItestkey";
    process.env.LIVEKIT_API_SECRET = "test-livekit-secret-value-32chars!";
    process.env.LIVEKIT_WS_URL = "ws://127.0.0.1:7880";
    delete process.env.LIVEKIT_HTTP_URL;

    expect(getLiveKitLiveSessionConfig()).toEqual({
      apiKey: "APItestkey",
      apiSecret: "test-livekit-secret-value-32chars!",
      wsUrl: "ws://127.0.0.1:7880",
      httpUrl: "http://127.0.0.1:7880",
    });
  });
});
