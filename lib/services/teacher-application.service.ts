import "server-only";
import { reconcilePublicTeacherDiscoveryEligibility } from "@/lib/services/public-teacher-discovery-eligibility.service";

import { prisma } from "@/lib/db/prisma";
import {
  canSubmitTeacherApplication,
} from "@/lib/domain/teacher-application";
import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import {
  TeacherApplicationNotReadyError,
  TeacherApplicationStateError,
} from "@/lib/errors/teacher-application-errors";
import { Prisma } from "@/lib/generated/prisma/client";

const teacherApplicationSelect = {
  id: true,
  userId: true,
  profileCompletedAt: true,

  applicationStatus: true,
  applicationSubmittedAt: true,
  applicationReviewedAt: true,
  applicationReviewNote: true,
  reviewCycle: true,
  profileRevision: true,
  submittedProfileRevision: true,
  submittedVideoId: true,
  submittedVideoRevision: true,
  submittedVideoUploadId: true,
  submittedVideoAssetId: true,

  introVideo: {
    select: {
      id: true,
      revision: true,
      provider: true,
      uploadId: true,
      assetId: true,
      status: true,
      durationSeconds: true,
      submittedAt: true,
      reviewedAt: true,
    },
  },
} satisfies Prisma.TeacherProfileSelect;

type TeacherApplicationContext =
  Prisma.TeacherProfileGetPayload<{
    select: typeof teacherApplicationSelect;
  }>;

function toApplicantApplication(application: TeacherApplicationContext) {
  const { submittedVideoUploadId: _submittedUpload, submittedVideoAssetId: _submittedAsset, introVideo, ...profile } = application;
  void _submittedUpload;
  void _submittedAsset;
  if (!introVideo) return { ...profile, introVideo: null };
  const { provider: _provider, uploadId: _upload, assetId: _asset, ...applicantVideo } = introVideo;
  void _provider;
  void _upload;
  void _asset;
  return { ...profile, introVideo: applicantVideo };
}

export type TeacherApplicationRecord = ReturnType<typeof toApplicantApplication>;

async function getTeacherApplicationContext(
  userId: string,
): Promise<TeacherApplicationContext> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      accountStatus: true,
      role: true,

      teacherProfile: {
        select: teacherApplicationSelect,
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

export async function getTeacherApplicationForUser(userId: string): Promise<TeacherApplicationRecord> {
  return toApplicantApplication(await getTeacherApplicationContext(userId));
}

export async function submitTeacherApplication(
  userId: string,
): Promise<TeacherApplicationRecord> {
  const application =
    await getTeacherApplicationContext(
      userId,
    );

  if (
    !canSubmitTeacherApplication(
      application.applicationStatus,
    )
  ) {
    throw new TeacherApplicationStateError();
  }

  if (
    !application.profileCompletedAt
  ) {
    throw new TeacherApplicationNotReadyError(
      "PROFILE_INCOMPLETE",
    );
  }

  if (
    !application.introVideo
  ) {
    throw new TeacherApplicationNotReadyError(
      "VIDEO_MISSING",
    );
  }

  const video =
    application.introVideo;

  const uploadId =
    video.uploadId;

  const assetId =
    video.assetId;

  const durationSeconds =
    video.durationSeconds;

  if (
    video.provider !== "mux" ||
    !uploadId ||
    /\s/.test(uploadId) ||
    !assetId ||
    /\s/.test(assetId) ||
    uploadId === assetId ||
    durationSeconds === null ||
    durationSeconds < 60 ||
    durationSeconds > 120 ||
    ![
      "READY_FOR_REVIEW",
      "APPROVED",
    ].includes(
      video.status,
    )
  ) {
    throw new TeacherApplicationNotReadyError(
      "VIDEO_NOT_READY",
    );
  }

  const submittedAt =
    new Date();

  await prisma.$transaction(
    async (
      tx,
    ) => {
      /*
       * Preserve the existing compare-and-set submission boundary:
       * the exact application/profile/video snapshot observed above
       * must still be current when the application moves to
       * PENDING_REVIEW.
       */
      const updateResult =
        await tx.teacherProfile.updateMany({
          where: {
            id:
              application.id,

            applicationStatus:
              application.applicationStatus,

            profileRevision:
              application.profileRevision,

            user: {
              accountStatus:
                "ACTIVE",
            },

            introVideo: {
              is: {
                id:
                  video.id,

                revision:
                  video.revision,

                provider:
                  "mux",

                uploadId,

                assetId,

                status:
                  video.status,

                durationSeconds,
              },
            },
          },

          data: {
            applicationStatus:
              "PENDING_REVIEW",

            applicationSubmittedAt:
              submittedAt,

            reviewCycle: {
              increment:
                1,
            },

            submittedProfileRevision:
              application.profileRevision,

            submittedVideoId:
              video.id,

            submittedVideoRevision:
              video.revision,

            submittedVideoUploadId:
              uploadId,

            submittedVideoAssetId:
              assetId,

            updatedAt:
              submittedAt,

            /*
             * Existing rejection feedback intentionally remains
             * persisted until the next administrative review.
             */
          },
        });

      if (
        updateResult.count !==
        1
      ) {
        throw new TeacherApplicationStateError();
      }

      /*
       * applicationStatus is a canonical discovery eligibility
       * source field. Moving to PENDING_REVIEW is necessarily
       * non-public, and reconciliation is committed atomically with
       * that source transition.
       */
      await reconcilePublicTeacherDiscoveryEligibility(
        application.id,
        tx,
      );
    },
  );

  return getTeacherApplicationForUser(
    userId,
  );
}
