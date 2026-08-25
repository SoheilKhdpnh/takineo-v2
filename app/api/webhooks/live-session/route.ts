import {
  LiveSessionConfigurationError,
} from "@/lib/errors/live-session-errors";
import {
  liveSessionWebhookErrorResponse,
} from "@/lib/errors/live-session-http";
import {
  getLiveSessionProvider,
} from "@/lib/live-session/provider";
import {
  ingestLiveSessionProviderEvent,
} from "@/lib/services/live-session-webhook.service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
): Promise<Response> {
  let event;

  try {
    const rawBody = await request.text();
    const provider = getLiveSessionProvider();
    event = provider.verifyAndParseWebhook(rawBody, request.headers);
  } catch (error) {
    if (error instanceof LiveSessionConfigurationError) {
      console.error(error);

      return Response.json(
        { error: "WEBHOOK_NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    return liveSessionWebhookErrorResponse(error);
  }

  try {
    const result = await ingestLiveSessionProviderEvent(event);

    return Response.json({
      received: true,
      duplicate: result.duplicate,
    });
  } catch (error) {
    return liveSessionWebhookErrorResponse(error);
  }
}
