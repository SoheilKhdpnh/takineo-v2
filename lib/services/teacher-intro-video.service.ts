import "server-only";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import {
  TeacherApplicationLockedError,
  TeacherProfileIncompleteError,
  TeacherVideoNotFoundError,
} from "@/lib/errors/teacher-video-errors";
import {
  canEditTeacherApplication,
  TEACHER_VIDEO_MAX_SECONDS,
  TEACHER_VIDEO_MIN_SECONDS,
} from "@/lib/domain/teacher-application";
import { serverEnv } from "@/lib/env/server";
import { getMuxClient } from "@/lib/video/mux-client";
import { queueMuxPlaybackIntent, reconcileMuxPlayback } from "@/lib/services/mux-playback-reconciliation.service";
import { cleanupMuxReviewPlayback } from "@/lib/video/mux-review-playback";

const teacherIntroVideoSelect = {
  id: true,
  provider: true,
  uploadId: true,
  assetId: true,
  publicPlaybackId: true,
  revision: true,
  status: true,
  durationSeconds: true,
  rejectionReason: true,
  submittedAt: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TeacherIntroVideoSelect;


export async function syncTeacherIntroVideoFromMux(
  userId: string,
) {
  const teacherProfile =
    await getTeacherVideoContext(userId);

  const introVideo =
    teacherProfile.introVideo;

  if (
    !introVideo ||
    !introVideo.uploadId
  ) {
    throw new TeacherVideoNotFoundError();
  }

  /*
   * These states no longer need provider
   * synchronization.
   */
  if (
    introVideo.status ===
      "READY_FOR_REVIEW" ||
    introVideo.status === "APPROVED" ||
    introVideo.status === "REJECTED" ||
    introVideo.status === "FAILED"
  ) {
    return getTeacherIntroVideoState(
      userId,
    );
  }

  const mux = getMuxClient();

  const upload =
    await mux.video.uploads.retrieve(
      introVideo.uploadId,
    );

  switch (upload.status) {
    case "waiting": {
      /*
       * Do not regress PROCESSING back to
       * UPLOAD_PENDING.
       */
      return getTeacherIntroVideoState(
        userId,
      );
    }

    case "asset_created": {
      if (!upload.asset_id) {
        return getTeacherIntroVideoState(
          userId,
        );
      }

      const asset =
        await mux.video.assets.retrieve(
          upload.asset_id,
        );

      if (asset.status === "errored") {
        await markTeacherVideoFailed({
          uploadId:
            introVideo.uploadId,

          assetId:
            upload.asset_id,

          reason:
            "MUX_ASSET_PROCESSING_FAILED",
        });

        return getTeacherIntroVideoState(
          userId,
        );
      }

      if (
        asset.status === "ready" &&
        typeof asset.duration === "number"
      ) {
        await markTeacherVideoReady({
          uploadId:
            introVideo.uploadId,

          assetId:
            upload.asset_id,

          duration:
            asset.duration,
        });

        return getTeacherIntroVideoState(
          userId,
        );
      }

      await markTeacherVideoProcessing(
        introVideo.uploadId,
        upload.asset_id,
      );

      return getTeacherIntroVideoState(
        userId,
      );
    }

    case "errored": {
      await markTeacherVideoFailed({
        uploadId:
          introVideo.uploadId,

        reason:
          "MUX_UPLOAD_FAILED",
      });

      break;
    }

    case "cancelled": {
      await markTeacherVideoFailed({
        uploadId:
          introVideo.uploadId,

        reason:
          "MUX_UPLOAD_CANCELLED",
      });

      break;
    }

    case "timed_out": {
      await markTeacherVideoFailed({
        uploadId:
          introVideo.uploadId,

        reason:
          "MUX_UPLOAD_TIMED_OUT",
      });

      break;
    }
  }

  return getTeacherIntroVideoState(
    userId,
  );
}

export async function markTeacherIntroVideoUploadComplete(
  userId: string,
  uploadId: string,
) {
  const teacherProfile =
    await getTeacherVideoContext(userId);

  const introVideo =
    teacherProfile.introVideo;

  if (
    !introVideo ||
    introVideo.uploadId !== uploadId
  ) {
    throw new TeacherVideoNotFoundError();
  }

  await prisma.teacherIntroVideo.updateMany({
    where: {
      id: introVideo.id,
      uploadId,
      status: "UPLOAD_PENDING",
    },

    data: {
      status: "PROCESSING",
    },
  });

  return getTeacherIntroVideoState(
    userId,
  );
}
type TeacherIntroVideoRecord =
  Prisma.TeacherIntroVideoGetPayload<{
    select: typeof teacherIntroVideoSelect;
  }>;

function toApplicantVideo(video: TeacherIntroVideoRecord | null) {
  if (!video) return null;
  const { provider: _provider, uploadId: _uploadId, assetId: _assetId, publicPlaybackId: _publicPlaybackId, ...applicantVideo } = video;
  void _provider;
  void _uploadId;
  void _assetId;
  void _publicPlaybackId;
  return applicantVideo;
}

async function getTeacherVideoContext(
  userId: string,
) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      accountStatus: true,
      role: true,

      teacherProfile: {
        select: {
          id: true,
          profileCompletedAt: true,
          applicationStatus: true,

          introVideo: {
            select: teacherIntroVideoSelect,
          },
        },
      },
    },
  });

  if (!user) {
    throw new ProfileNotFoundError();
  }

  if (user.accountStatus !== "ACTIVE") {
    throw new ProfileNotFoundError();
  }

  if (user.role !== "TEACHER") {
    throw new ProfileRoleMismatchError();
  }

  if (!user.teacherProfile) {
    throw new ProfileNotFoundError();
  }

  return user.teacherProfile;
}

export async function getTeacherIntroVideoState(
  userId: string,
) {
  const teacherProfile =
    await getTeacherVideoContext(userId);

  return {
    applicationStatus:
      teacherProfile.applicationStatus,

    canUpload: canEditTeacherApplication(
      teacherProfile.applicationStatus,
    ),

    introVideo:
      toApplicantVideo(teacherProfile.introVideo),
  };
}

export async function createTeacherIntroVideoUpload(
  userId: string,
) {
  const teacherProfile =
    await getTeacherVideoContext(userId);

  if (!teacherProfile.profileCompletedAt) {
    throw new TeacherProfileIncompleteError();
  }

  if (
    !canEditTeacherApplication(
      teacherProfile.applicationStatus,
    )
  ) {
    throw new TeacherApplicationLockedError();
  }

  const previousReviewPlaybackId = teacherProfile.introVideo
    ? await prisma.teacherIntroVideo.findUnique({ where: { id: teacherProfile.introVideo.id }, select: { reviewPlaybackId: true } }).then((row) => row?.reviewPlaybackId ?? null)
    : null;

  const mux = getMuxClient();

  const upload =
    await mux.video.uploads.create({
      cors_origin: new URL(
        serverEnv.BETTER_AUTH_URL,
      ).origin,

      timeout: 3600,

      new_asset_settings: {
        passthrough: teacherProfile.id,

        meta: {
          external_id: teacherProfile.id,
          creator_id: userId,
        },

        video_quality: "basic",
      },
    });

  if (!upload.url) {
    throw new Error(
      "Mux did not return a direct-upload URL.",
    );
  }

  const databaseResult = await (async () => {
    try {
      return await prisma.$transaction(async (tx) => {
        const current = teacherProfile.introVideo;
        if (!current) {
          const eligible = await tx.teacherProfile.count({ where: { id: teacherProfile.id, applicationStatus: { in: ["DRAFT", "REJECTED"] }, user: { id: userId, accountStatus: "ACTIVE" }, introVideo: { is: null } } });
          if (eligible !== 1) throw new TeacherApplicationLockedError();
          const introVideo = await tx.teacherIntroVideo.create({
            data: { teacherProfileId: teacherProfile.id, provider: "mux", uploadId: upload.id, status: "UPLOAD_PENDING" },
            select: teacherIntroVideoSelect,
          });
          return { introVideo, reconciliationId: null as string | null };
        }
        let reconciliationId: string | null = null;
        if (current.assetId) {
          const reconciliation = await queueMuxPlaybackIntent(tx, { introVideoId: current.id, videoRevision: current.revision, assetId: current.assetId, playbackId: current.publicPlaybackId, desiredState: "REVOKED" });
          reconciliationId = reconciliation.id;
        }
        const changed = await tx.teacherIntroVideo.updateMany({
          where: { id: current.id, revision: current.revision, teacherProfile: { applicationStatus: { in: ["DRAFT", "REJECTED"] }, user: { accountStatus: "ACTIVE" } } },
          data: { provider: "mux", uploadId: upload.id, assetId: null, reviewPlaybackId: null, publicPlaybackId: null, revision: { increment: 1 }, status: "UPLOAD_PENDING", durationSeconds: null, rejectionReason: null, submittedAt: null, reviewedAt: null },
        });
        if (changed.count !== 1) throw new TeacherApplicationLockedError();
        const introVideo = await tx.teacherIntroVideo.findUniqueOrThrow({ where: { id: current.id }, select: teacherIntroVideoSelect });
        return { introVideo, reconciliationId };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      try { await mux.video.uploads.cancel(upload.id); }
      catch { /* The URL is never returned; an uncancelled orphan expires at Mux. */ }
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw new TeacherApplicationLockedError();
      throw error;
    }
  })();
  if (databaseResult.reconciliationId) await reconcileMuxPlayback(databaseResult.reconciliationId);
  if (teacherProfile.introVideo?.assetId) {
    await cleanupMuxReviewPlayback({ videoId: teacherProfile.introVideo.id, videoRevision: teacherProfile.introVideo.revision, assetId: teacherProfile.introVideo.assetId, playbackId: previousReviewPlaybackId });
  }

  return {
    introVideo: toApplicantVideo(databaseResult.introVideo),

    upload: {
      id: upload.id,
      url: upload.url,
      timeoutSeconds:
        upload.timeout ?? 3600,
    },
  };
}

export async function markTeacherVideoProcessing(
  uploadId: string,
  assetId: string,
) {
  return prisma.teacherIntroVideo.updateMany({
    where: {
      uploadId,
      status: { in: ["UPLOAD_PENDING", "PROCESSING"] },
      OR: [{ assetId: null }, { assetId }],
    },

    data: {
      assetId,
      status: "PROCESSING",
      rejectionReason: null,
    },
  });
}

export async function markTeacherVideoReady(
  input: {
    assetId: string;
    uploadId?: string;
    duration: number;
  },
) {
  const durationIsValid =
    input.duration >=
      TEACHER_VIDEO_MIN_SECONDS &&
    input.duration <=
      TEACHER_VIDEO_MAX_SECONDS;

  const durationSeconds = Math.round(
    input.duration,
  );

  const lookup: Prisma.TeacherIntroVideoWhereInput =
    input.uploadId
      ? {
          uploadId: input.uploadId,
          OR: [{ assetId: null }, { assetId: input.assetId }],
        }
      : {
          assetId: input.assetId,
        };

  return prisma.teacherIntroVideo.updateMany({
    where: { AND: [lookup, { status: { in: ["UPLOAD_PENDING", "PROCESSING"] } }] },

    data: {
      assetId: input.assetId,
      durationSeconds,

      status: durationIsValid
        ? "READY_FOR_REVIEW"
        : "REJECTED",

      rejectionReason: durationIsValid
        ? null
        : "VIDEO_DURATION_OUT_OF_RANGE",

      submittedAt: durationIsValid
        ? new Date()
        : null,

      reviewedAt: null,
      reviewPlaybackId: null,
    },
  });
}

export async function markTeacherVideoFailed(
  input: {
    uploadId?: string;
    assetId?: string;
    reason: string;
  },
) {
  if (!input.uploadId && !input.assetId) {
    return {
      count: 0,
    };
  }

  return prisma.teacherIntroVideo.updateMany({
    where: {
      ...(input.uploadId ? { uploadId: input.uploadId } : {}),
      ...(input.assetId ? { assetId: input.assetId } : {}),
      status: { in: ["UPLOAD_PENDING", "PROCESSING"] },
    },

    data: {
      status: "FAILED",
      rejectionReason: input.reason,
      submittedAt: null,
      reviewedAt: null,
      reviewPlaybackId: null,
    },
  });
}
