import "server-only";

import {
  getLiveSessionWebhookSecret,
} from "@/lib/env/live-session";
import {
  createFakeLiveSessionProvider,
  type FakeLiveSessionProvider,
} from "@/lib/live-session/fake-provider";

export type LiveSessionRuntimeProvider = FakeLiveSessionProvider;

/*
 * Provider selection is still open. Wave 3 M3 ships a fake adapter so
 * services and the webhook signature seam are testable without a vendor SDK.
 */
export function getLiveSessionProvider(): LiveSessionRuntimeProvider {
  return createFakeLiveSessionProvider({
    webhookSecret: getLiveSessionWebhookSecret(),
  });
}
