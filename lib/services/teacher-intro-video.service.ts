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

const teacherIntroVideoSelect = {
  id: true,
  provider: true,
  uploadId: true,
  assetId: true,
  playbackId: true,
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
export type TeacherIntroVideoRecord =
  Prisma.TeacherIntroVideoGetPayload<{
    select: typeof teacherIntroVideoSelect;
  }>;

async function getTeacherVideoContext(
  userId: string,
) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
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
      teacherProfile.introVideo,
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

  const previousAssetId =
    teacherProfile.introVideo?.assetId ?? null;

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

  const introVideo =
    await prisma.teacherIntroVideo.upsert({
      where: {
        teacherProfileId:
          teacherProfile.id,
      },

      create: {
        teacherProfileId:
          teacherProfile.id,
        provider: "mux",
        uploadId: upload.id,
        status: "UPLOAD_PENDING",
      },

      update: {
        provider: "mux",
        uploadId: upload.id,
        assetId: null,
        playbackId: null,
        status: "UPLOAD_PENDING",
        durationSeconds: null,
        rejectionReason: null,
        submittedAt: null,
        reviewedAt: null,
      },

      select: teacherIntroVideoSelect,
    });

  /*
   * The new database record is saved first.
   * Removing an old rejected/failed asset is cleanup;
   * it must not prevent creation of the new upload.
   */
  if (previousAssetId) {
    try {
      await mux.video.assets.delete(
        previousAssetId,
      );
    } catch (error) {
      console.error(
        "Unable to remove previous Mux asset:",
        error,
      );
    }
  }

  return {
    introVideo,

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
          OR: [
            {
              uploadId: input.uploadId,
            },
            {
              assetId: input.assetId,
            },
          ],
        }
      : {
          assetId: input.assetId,
        };

  return prisma.teacherIntroVideo.updateMany({
    where: lookup,

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
      playbackId: null,
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
  const conditions: Prisma.TeacherIntroVideoWhereInput[] =
    [];

  if (input.uploadId) {
    conditions.push({
      uploadId: input.uploadId,
    });
  }

  if (input.assetId) {
    conditions.push({
      assetId: input.assetId,
    });
  }

  if (conditions.length === 0) {
    return {
      count: 0,
    };
  }

  return prisma.teacherIntroVideo.updateMany({
    where: {
      OR: conditions,
    },

    data: {
      status: "FAILED",
      rejectionReason: input.reason,
      submittedAt: null,
      reviewedAt: null,
      playbackId: null,
    },
  });
}