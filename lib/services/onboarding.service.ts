import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { UserRole } from "@/lib/domain/user-role";
import {
  OnboardingAlreadyCompletedError,
  OnboardingStateConflictError,
  UserNotFoundError,
} from "@/lib/errors/onboarding-errors";
import { Prisma } from "@/lib/generated/prisma/client";

interface CompleteOnboardingInput {
  userId: string;
  role: UserRole;
}

const completedUserSelect = {
  id: true,
  role: true,
  onboardingCompletedAt: true,
} satisfies Prisma.UserSelect;

export async function completeOnboarding({
  userId,
  role,
}: CompleteOnboardingInput) {
  /*
   * Read the current state outside an interactive transaction.
   *
   * This check provides useful domain errors without keeping a
   * database transaction open across several network round trips.
   */
  const currentUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      role: true,
      accountStatus: true,
      onboardingCompletedAt: true,

      studentProfile: {
        select: {
          id: true,
        },
      },

      teacherProfile: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!currentUser) {
    throw new UserNotFoundError();
  }

  if (currentUser.accountStatus !== "ACTIVE") {
    throw new OnboardingStateConflictError();
  }

  if (
    currentUser.role !== null ||
    currentUser.onboardingCompletedAt !== null
  ) {
    throw new OnboardingAlreadyCompletedError();
  }

  if (
    currentUser.studentProfile !== null ||
    currentUser.teacherProfile !== null
  ) {
    throw new OnboardingStateConflictError();
  }

  const onboardingCompletedAt = new Date();

  try {
    /*
     * The unique user ID identifies the record.
     *
     * The additional null filters act as an atomic claim:
     * a concurrent second request cannot onboard the same user
     * after the first request assigns a role.
     */
    if (role === "STUDENT") {
      return await prisma.user.update({
        where: {
          id: userId,
          role: null,
          onboardingCompletedAt: null,
          accountStatus: "ACTIVE",
        },

        data: {
          role: "STUDENT",
          onboardingCompletedAt,

          studentProfile: {
            create: {},
          },
        },

        select: completedUserSelect,
      });
    }

    return await prisma.user.update({
      where: {
        id: userId,
        role: null,
        onboardingCompletedAt: null,
        accountStatus: "ACTIVE",
      },

      data: {
        role: "TEACHER",
        onboardingCompletedAt,

        teacherProfile: {
          create: {},
        },
      },

      select: completedUserSelect,
    });
  } catch (error) {
    if (
      error instanceof
      Prisma.PrismaClientKnownRequestError
    ) {
      /*
       * P2025 means the conditional update found no matching
       * incomplete user. Another request may have already
       * completed onboarding.
       */
      if (error.code === "P2025") {
        throw new OnboardingAlreadyCompletedError();
      }

      /*
       * P2002 means a unique profile constraint was reached.
       * Treat that as an inconsistent onboarding state.
       */
      if (error.code === "P2002") {
        throw new OnboardingStateConflictError();
      }
    }

    throw error;
  }
}
