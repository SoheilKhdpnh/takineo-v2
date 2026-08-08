import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AdminForbiddenError } from "@/lib/errors/admin-errors";

export type AdminCapability = "REVIEW" | "MODERATE_TEACHER";

export async function requireAdminAccess(userId: string, capability: AdminCapability = "REVIEW") {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountStatus: true, adminAccess: { select: { permission: true, revokedAt: true } } },
  });

  if (!user || user.accountStatus !== "ACTIVE" || !user.adminAccess || user.adminAccess.revokedAt) {
    throw new AdminForbiddenError();
  }
  if (capability === "MODERATE_TEACHER" && user.adminAccess.permission !== "SUPER_ADMIN") {
    throw new AdminForbiddenError();
  }
  return { userId, permission: user.adminAccess.permission };
}
