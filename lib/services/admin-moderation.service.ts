import "server-only";

import { requireAdminAccess } from "@/lib/auth/admin-access";
import { prisma } from "@/lib/db/prisma";

export type ModeratableTeacherStatus = "APPROVED" | "SUSPENDED";

export async function listModeratableTeachers(
  actorUserId: string,
  input: {
    status: ModeratableTeacherStatus;
    cursor?: string;
    limit: number;
  },
) {
  await requireAdminAccess(actorUserId, "MODERATE_TEACHER");

  const rows = await prisma.teacherProfile.findMany({
    where: {
      applicationStatus: input.status,
    },
    take: input.limit + 1,
    ...(input.cursor
      ? {
          cursor: { id: input.cursor },
          skip: 1,
        }
      : {}),
    orderBy: [{ applicationReviewedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      headline: true,
      applicationStatus: true,
      applicationReviewedAt: true,
      reviewCycle: true,
      updatedAt: true,
      user: {
        select: {
          name: true,
          email: true,
          accountStatus: true,
        },
      },
    },
  });

  const hasNextPage = rows.length > input.limit;
  const teachers = hasNextPage ? rows.slice(0, input.limit) : rows;

  return {
    teachers,
    nextCursor: hasNextPage ? teachers.at(-1)?.id ?? null : null,
  };
}
