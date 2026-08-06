import "server-only";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export const userAccessSelect = {
  id: true,
  role: true,
  onboardingCompletedAt: true,

  studentProfile: {
    select: {
      id: true,
      profileCompletedAt: true,
    },
  },

  teacherProfile: {
    select: {
      id: true,
      applicationStatus: true,
      profileCompletedAt: true,

      introVideo: {
        select: {
          id: true,
          status: true,
        durationSeconds: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

export type UserAccessContext =
  Prisma.UserGetPayload<{
    select: typeof userAccessSelect;
  }>;

export async function getUserAccessContext(
  userId: string,
): Promise<UserAccessContext | null> {
  return prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: userAccessSelect,
  });
}