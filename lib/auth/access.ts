import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

const userAccessSelect = {
  id: true,
  role: true,
  onboardingCompletedAt: true,

  studentProfile: {
    select: {
      id: true,
    },
  },

  teacherProfile: {
    select: {
      id: true,
      isVerified: true,
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