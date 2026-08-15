import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AdminTargetNotFoundError } from "@/lib/errors/admin-errors";

export type AdminOperatorUserIdentifier =
  | { userId: string }
  | { email: string };

export type AdminOperatorUserSnapshot = {
  id: string;
  name: string;
  email: string;
  accountStatus: "ACTIVE" | "SUSPENDED" | "DISABLED";
  adminPermission: "REVIEWER" | "SUPER_ADMIN" | null;
};

export async function resolveAdminOperatorUser(
  identifier: AdminOperatorUserIdentifier,
): Promise<AdminOperatorUserSnapshot> {
  const user = await prisma.user.findUnique({
    where: "userId" in identifier
      ? { id: identifier.userId }
      : { email: identifier.email },
    select: {
      id: true,
      name: true,
      email: true,
      accountStatus: true,
      adminAccess: {
        select: {
          permission: true,
          revokedAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new AdminTargetNotFoundError();
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    accountStatus: user.accountStatus,
    adminPermission: user.adminAccess && !user.adminAccess.revokedAt
      ? user.adminAccess.permission
      : null,
  };
}
