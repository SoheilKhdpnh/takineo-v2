import "server-only";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import { fromTimezoneEnum, toTimezoneEnum, type IanaTimezone} from "@/lib/timezone";
import type { StudentProfileInput } from "@/lib/validations/student-profile";

const studentProfileSelect = {
  id: true,
  userId: true,
  englishLevel: true,
  learningGoal: true,
  nativeLanguage: true,
  timezone: true,
  profileCompletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StudentProfileSelect;

type StudentProfileRow = Prisma.StudentProfileGetPayload<{
  select: typeof studentProfileSelect;
}>;

export type StudentProfileRecord = Omit<StudentProfileRow, "timezone"> & {
  timezone: IanaTimezone;
};

function toRecord(row: StudentProfileRow): StudentProfileRecord {
  return {
    ...row,
    timezone: fromTimezoneEnum(row.timezone),
  };
}

export async function getStudentProfileForUser(
  userId: string,
): Promise<StudentProfileRecord> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      role: true,

      studentProfile: {
        select: studentProfileSelect,
      },
    },
  });

  if (!user) {
    throw new ProfileNotFoundError();
  }

  if (user.role !== "STUDENT") {
    throw new ProfileRoleMismatchError();
  }

  if (!user.studentProfile) {
    throw new ProfileNotFoundError();
  }

  return toRecord(user.studentProfile);
}

export async function saveStudentProfile(
  userId: string,
  input: StudentProfileInput,
): Promise<StudentProfileRecord> {
  const currentProfile = await getStudentProfileForUser(userId);

  try {
    const updated = await prisma.studentProfile.update({
      where: {
        userId,
      },

      data: {
        englishLevel: input.englishLevel,
        learningGoal: input.learningGoal,
        nativeLanguage: input.nativeLanguage,
        timezone: toTimezoneEnum(input.timezone),

        profileCompletedAt:
          currentProfile.profileCompletedAt ?? new Date(),
      },

      select: studentProfileSelect,
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