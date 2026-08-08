import "server-only";

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
      uploadId: true,
      assetId: true,
      status: true,
      durationSeconds: true,
      submittedAt: true,
      reviewedAt: true,
    },
  },
} satisfies Prisma.TeacherProfileSelect;

export type TeacherApplicationRecord =
  Prisma.TeacherProfileGetPayload<{
    select: typeof teacherApplicationSelect;
  }>;

export async function getTeacherApplicationForUser(
  userId: string,
): Promise<TeacherApplicationRecord> {
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

function isAcceptableSubmissionVideo(
  status:
    | "UPLOAD_PENDING"
    | "PROCESSING"
    | "READY_FOR_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "FAILED",
): boolean {
  return (
    status === "READY_FOR_REVIEW" ||
    status === "APPROVED"
  );
}

export async function submitTeacherApplication(
  userId: string,
): Promise<TeacherApplicationRecord> {
  const application =
    await getTeacherApplicationForUser(userId);

  if (
    !canSubmitTeacherApplication(
      application.applicationStatus,
    )
  ) {
    throw new TeacherApplicationStateError();
  }

  if (!application.profileCompletedAt) {
    throw new TeacherApplicationNotReadyError(
      "PROFILE_INCOMPLETE",
    );
  }

  if (!application.introVideo) {
    throw new TeacherApplicationNotReadyError(
      "VIDEO_MISSING",
    );
  }

  if (!application.introVideo.uploadId || !application.introVideo.assetId) {
    throw new TeacherApplicationNotReadyError("VIDEO_NOT_READY");
  }

  if (
    !isAcceptableSubmissionVideo(
      application.introVideo.status,
    )
  ) {
    throw new TeacherApplicationNotReadyError(
      "VIDEO_NOT_READY",
    );
  }

  /*
   * Compare-and-set:
   *
   * Only change the application if it is still in
   * the state we just validated.
   *
   * This prevents two concurrent requests from
   * incorrectly submitting the same application.
   */
  const submittedAt = new Date();
  const updateResult =
    await prisma.teacherProfile.updateMany({
      where: {
        id: application.id,
        applicationStatus:
          application.applicationStatus,
        profileRevision: application.profileRevision,
        user: { accountStatus: "ACTIVE" },
        introVideo: {
          is: {
            id: application.introVideo.id,
            revision: application.introVideo.revision,
            uploadId: application.introVideo.uploadId,
            assetId: application.introVideo.assetId,
            status: application.introVideo.status,
          },
        },
      },

      data: {
        applicationStatus:
          "PENDING_REVIEW",

        applicationSubmittedAt:
          submittedAt,
        reviewCycle: { increment: 1 },
        submittedProfileRevision: application.profileRevision,
        submittedVideoId: application.introVideo.id,
        submittedVideoRevision: application.introVideo.revision,
        submittedVideoUploadId: application.introVideo.uploadId,
        submittedVideoAssetId: application.introVideo.assetId,
        updatedAt: submittedAt,

        /*
         * A previous rejection note is retained
         * until the next administrative review.
         * Later we will move review history into
         * a proper audit model.
         */
      },
    });

  if (updateResult.count !== 1) {
    throw new TeacherApplicationStateError();
  }

  return getTeacherApplicationForUser(
    userId,
  );
}
