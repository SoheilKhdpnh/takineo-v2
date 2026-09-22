import "server-only";

import { Prisma } from "@/lib/generated/prisma/client";
import { interactiveTransactionOptions } from "@/lib/db/interactive-transaction";
import { prisma } from "@/lib/db/prisma";
import {
  parseAparatVideoUrl,
  type ParsedAparatVideo,
} from "@/lib/domain/aparat-video";
import { canEditTeacherApplication } from "@/lib/domain/teacher-application";
import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import {
  TeacherApplicationLockedError,
  TeacherProfileIncompleteError,
  TeacherVideoInvalidAparatUrlError,
} from "@/lib/errors/teacher-video-errors";
import { generateVideoVerificationCode } from "@/lib/video/verification-code";

const teacherIntroVideoSelect = {
  id: true,
  provider: true,
  aparatUrl: true,
  aparatHash: true,
  revision: true,
  status: true,
  rejectionReason: true,
  submittedAt: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TeacherIntroVideoSelect;

type TeacherIntroVideoRecord = Prisma.TeacherIntroVideoGetPayload<{
  select: typeof teacherIntroVideoSelect;
}>;

function toApplicantVideo(video: TeacherIntroVideoRecord | null) {
  if (!video) {
    return null;
  }

  const parsed =
    video.aparatHash && video.aparatUrl
      ? parseAparatVideoUrl(video.aparatUrl)
      : null;

  return {
    id: video.id,
    revision: video.revision,
    status: video.status,
    aparatUrl: parsed?.canonicalUrl ?? video.aparatUrl,
    embedUrl: parsed?.embedUrl ?? null,
    rejectionReason: video.rejectionReason,
    submittedAt: video.submittedAt,
    reviewedAt: video.reviewedAt,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
  };
}

async function getTeacherVideoContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accountStatus: true,
      role: true,
      teacherProfile: {
        select: {
          id: true,
          profileCompletedAt: true,
          applicationStatus: true,
          videoVerificationCode: true,
          introVideo: { select: teacherIntroVideoSelect },
        },
      },
    },
  });

  if (!user || user.accountStatus !== "ACTIVE") {
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

async function ensureVideoVerificationCode(
  teacherProfileId: string,
  current: string | null,
) {
  if (current) {
    return current;
  }

  const code = generateVideoVerificationCode();
  const updated = await prisma.teacherProfile.updateMany({
    where: { id: teacherProfileId, videoVerificationCode: null },
    data: { videoVerificationCode: code },
  });

  if (updated.count === 1) {
    return code;
  }

  const persisted = await prisma.teacherProfile.findUnique({
    where: { id: teacherProfileId },
    select: { videoVerificationCode: true },
  });

  return persisted?.videoVerificationCode ?? code;
}

export async function getTeacherIntroVideoState(userId: string) {
  const teacherProfile = await getTeacherVideoContext(userId);
  const verificationCode = await ensureVideoVerificationCode(
    teacherProfile.id,
    teacherProfile.videoVerificationCode,
  );

  return {
    applicationStatus: teacherProfile.applicationStatus,
    canEdit: canEditTeacherApplication(teacherProfile.applicationStatus),
    verificationCode,
    introVideo: toApplicantVideo(teacherProfile.introVideo),
  };
}

export async function submitTeacherIntroVideoLink(
  userId: string,
  rawUrl: string,
) {
  const parsed = parseAparatVideoUrl(rawUrl);
  if (!parsed) {
    throw new TeacherVideoInvalidAparatUrlError();
  }

  const teacherProfile = await getTeacherVideoContext(userId);

  if (!teacherProfile.profileCompletedAt) {
    throw new TeacherProfileIncompleteError();
  }

  if (!canEditTeacherApplication(teacherProfile.applicationStatus)) {
    throw new TeacherApplicationLockedError();
  }

  await ensureVideoVerificationCode(
    teacherProfile.id,
    teacherProfile.videoVerificationCode,
  );

  const submittedAt = new Date();

  try {
    await prisma.$transaction(
      async (tx) => {
        const current = teacherProfile.introVideo;

        if (!current) {
          const eligible = await tx.teacherProfile.count({
            where: {
              id: teacherProfile.id,
              applicationStatus: { in: ["DRAFT", "REJECTED"] },
              user: { id: userId, accountStatus: "ACTIVE" },
              introVideo: { is: null },
            },
          });

          if (eligible !== 1) {
            throw new TeacherApplicationLockedError();
          }

          await tx.teacherIntroVideo.create({
            data: {
              teacherProfileId: teacherProfile.id,
              provider: "aparat",
              aparatUrl: parsed.canonicalUrl,
              aparatHash: parsed.hash,
              status: "READY_FOR_REVIEW",
              rejectionReason: null,
              submittedAt,
              reviewedAt: null,
            },
          });
          return;
        }

        const unchanged =
          current.aparatHash === parsed.hash &&
          (current.status === "READY_FOR_REVIEW" ||
            current.status === "APPROVED");

        if (unchanged) {
          return;
        }

        const changed = await tx.teacherIntroVideo.updateMany({
          where: {
            id: current.id,
            revision: current.revision,
            teacherProfile: {
              applicationStatus: { in: ["DRAFT", "REJECTED"] },
              user: { accountStatus: "ACTIVE" },
            },
          },
          data: {
            provider: "aparat",
            aparatUrl: parsed.canonicalUrl,
            aparatHash: parsed.hash,
            revision: { increment: 1 },
            status: "READY_FOR_REVIEW",
            rejectionReason: null,
            submittedAt,
            reviewedAt: null,
          },
        });

        if (changed.count !== 1) {
          throw new TeacherApplicationLockedError();
        }
      },
      { ...interactiveTransactionOptions, isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(error.code)
    ) {
      throw new TeacherApplicationLockedError();
    }

    throw error;
  }

  return getTeacherIntroVideoState(userId);
}

export function getParsedAparatVideo(
  url: string | null | undefined,
): ParsedAparatVideo | null {
  if (!url) {
    return null;
  }

  return parseAparatVideoUrl(url);
}
