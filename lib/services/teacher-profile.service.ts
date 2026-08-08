import "server-only";
import { TeacherApplicationLockedError } from "@/lib/errors/teacher-video-errors";
import { canEditTeacherApplication } from "@/lib/domain/teacher-application";
import { Prisma, Timezone } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import { fromTimezoneEnum, toTimezoneEnum, type IanaTimezone} from "@/lib/timezone";
import type { TeacherProfileInput } from "@/lib/validations/teacher-profile";

const teacherProfileSelect = {
  id: true,
  userId: true,
  headline: true,
  bio: true,
  experienceYears: true,
  nativeLanguage: true,
  teachingLanguage: true,
  timezone: true,
  profileCompletedAt: true,
  applicationStatus: true,
  applicationSubmittedAt: true,
  applicationReviewedAt: true,
  applicationReviewNote: true,
  createdAt: true,
  updatedAt: true,

  introVideo: {
  select: {
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
  },
}
} satisfies Prisma.TeacherProfileSelect;

type TeacherProfileRow = Prisma.TeacherProfileGetPayload<{
  select: typeof teacherProfileSelect;
}>;

export type TeacherProfileRecord = Omit<TeacherProfileRow, "timezone"> & {
  timezone: IanaTimezone;
};

function toRecord(row: TeacherProfileRow): TeacherProfileRecord {
  return {
    ...row,
    timezone: fromTimezoneEnum(row.timezone),
  };
}

export async function getTeacherProfileForUser(
  userId: string,
): Promise<TeacherProfileRecord> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      role: true,

      teacherProfile: {
        select: teacherProfileSelect,
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

  return toRecord(user.teacherProfile);
}

export async function saveTeacherProfile(
  userId: string,
  input: TeacherProfileInput,
): Promise<TeacherProfileRecord> {
  const currentProfile = await getTeacherProfileForUser(userId);
if (
  !canEditTeacherApplication(
    currentProfile.applicationStatus,
  )
) {
  throw new TeacherApplicationLockedError();
}

  try {
    const updated = await prisma.teacherProfile.update({
      where: {
        userId,
      },

      data: {
        headline: input.headline,
        bio: input.bio,
        experienceYears: input.experienceYears,
        nativeLanguage: input.nativeLanguage,
        teachingLanguage: input.teachingLanguage,
        timezone: toTimezoneEnum(input.timezone),

        profileCompletedAt:
          currentProfile.profileCompletedAt ?? new Date(),
      },

      select: teacherProfileSelect,
    });

    return toRecord(updated);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new ProfileNotFoundError();
    }

    throw error;
  }
}