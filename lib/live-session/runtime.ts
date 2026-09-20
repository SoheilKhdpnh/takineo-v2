import type {
  LiveSessionProviderAdapter,
  LiveSessionProviderEvidenceEvent,
} from "@/lib/domain/live-session/provider";

export type LiveSessionWebhookParseResult =
  LiveSessionProviderEvidenceEvent | null;

export type LiveSessionRuntimeProvider =
  LiveSessionProviderAdapter &
  Readonly<{
    allocateProviderParticipantRef: () => string;
    getJoinUrl: () => string;
    verifyAndParseWebhook: (
      rawBody: string,
      headers: Headers,
    ) =>
      | LiveSessionWebhookParseResult
      | Promise<LiveSessionWebhookParseResult>;
  }>;
