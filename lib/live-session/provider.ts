import "server-only";

import {
  getLiveKitLiveSessionConfig,
  getLiveSessionProviderName,
  getLiveSessionWebhookSecret,
} from "@/lib/env/live-session";
import {
  createFakeLiveSessionProvider,
} from "@/lib/live-session/fake-provider";
import {
  createLiveKitLiveSessionProvider,
} from "@/lib/live-session/livekit-provider";
import type {
  LiveSessionRuntimeProvider,
} from "@/lib/live-session/runtime";

export type {
  LiveSessionRuntimeProvider,
} from "@/lib/live-session/runtime";

export function getLiveSessionProvider(): LiveSessionRuntimeProvider {
  const providerName = getLiveSessionProviderName();

  if (providerName === "livekit") {
    return createLiveKitLiveSessionProvider(
      getLiveKitLiveSessionConfig(),
    );
  }

  return createFakeLiveSessionProvider({
    webhookSecret: getLiveSessionWebhookSecret(),
  });
}
