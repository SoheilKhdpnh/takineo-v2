import { z } from "zod";

import {
  markTeacherVideoFailed,
  markTeacherVideoProcessing,
  markTeacherVideoReady,
} from "@/lib/services/teacher-intro-video.service";
import { getMuxClient } from "@/lib/video/mux-client";
import {
  getMuxWebhookSecret,
  MuxConfigurationError,
} from "@/lib/video/mux-config";

export const runtime = "nodejs";

const uploadAssetCreatedEventSchema =
  z.object({
    type: z.literal(
      "video.upload.asset_created",
    ),

    data: z.object({
      id: z.string().min(1),
      asset_id: z.string().min(1),
    }),
  });

const assetReadyEventSchema = z.object({
  type: z.literal("video.asset.ready"),

  data: z.object({
    id: z.string().min(1),
    upload_id: z.string().min(1).optional(),
    duration: z.number().nonnegative(),
  }),
});

const assetErroredEventSchema = z.object({
  type: z.literal("video.asset.errored"),

  data: z.object({
    id: z.string().min(1),
    upload_id: z.string().min(1).optional(),
  }),
});

const uploadErroredEventSchema = z.object({
  type: z.literal("video.upload.errored"),

  data: z.object({
    id: z.string().min(1),
  }),
});

const baseEventSchema = z.object({
  type: z.string(),
});

export async function POST(
  request: Request,
): Promise<Response> {
  let verifiedEvent: unknown;

  try {
    const rawBody = await request.text();

    verifiedEvent =
      getMuxClient().webhooks.unwrap(
        rawBody,
        request.headers,
        getMuxWebhookSecret(),
      );
  } catch (error) {
    if (
      error instanceof MuxConfigurationError
    ) {
      console.error(error);

      return Response.json(
        {
          error:
            "WEBHOOK_NOT_CONFIGURED",
        },
        {
          status: 503,
        },
      );
    }

    console.warn(
      "Rejected invalid Mux webhook:",
      error,
    );

    return Response.json(
      {
        error:
          "INVALID_WEBHOOK_SIGNATURE",
      },
      {
        status: 400,
      },
    );
  }

  const baseResult =
    baseEventSchema.safeParse(
      verifiedEvent,
    );

  if (!baseResult.success) {
    return Response.json(
      {
        error: "INVALID_WEBHOOK_BODY",
      },
      {
        status: 400,
      },
    );
  }

  try {
    switch (baseResult.data.type) {
      case "video.upload.asset_created": {
        const event =
          uploadAssetCreatedEventSchema.parse(
            verifiedEvent,
          );

        await markTeacherVideoProcessing(
          event.data.id,
          event.data.asset_id,
        );

        break;
      }

      case "video.asset.ready": {
        const event =
          assetReadyEventSchema.parse(
            verifiedEvent,
          );

        await markTeacherVideoReady({
          assetId: event.data.id,
          uploadId: event.data.upload_id,
          duration: event.data.duration,
        });

        break;
      }

      case "video.asset.errored": {
        const event =
          assetErroredEventSchema.parse(
            verifiedEvent,
          );

        await markTeacherVideoFailed({
          assetId: event.data.id,
          uploadId: event.data.upload_id,
          reason:
            "MUX_ASSET_PROCESSING_FAILED",
        });

        break;
      }

      case "video.upload.errored": {
        const event =
          uploadErroredEventSchema.parse(
            verifiedEvent,
          );

        await markTeacherVideoFailed({
          uploadId: event.data.id,
          reason: "MUX_UPLOAD_FAILED",
        });

        break;
      }

      default:
        /*
         * Mux sends many event types.
         * Events unrelated to teacher intro videos
         * are acknowledged and ignored.
         */
        break;
    }

    return Response.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "Mux webhook processing failed:",
      error,
    );

    /*
     * A 500 response lets Mux retry delivery.
     */
    return Response.json(
      {
        error:
          "WEBHOOK_PROCESSING_FAILED",
      },
      {
        status: 500,
      },
    );
  }
}