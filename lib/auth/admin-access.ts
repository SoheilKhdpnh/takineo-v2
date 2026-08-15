import "server-only";

import {
  prisma,
} from "@/lib/db/prisma";
import {
  AdminForbiddenError,
} from "@/lib/errors/admin-errors";

export type AdminCapability =
  | "REVIEW"
  | "MODERATE_TEACHER"
  | "MODERATE_ACCOUNT"
  | "MANAGE_ADMIN_ACCESS"
  | "MANAGE_SESSIONS";

export type AdminPermissionValue =
  | "REVIEWER"
  | "SUPER_ADMIN";

export function adminPermissionHasCapability(
  permission:
    AdminPermissionValue,
  capability:
    AdminCapability,
): boolean {
  if (
    capability ===
    "REVIEW"
  ) {
    return true;
  }

  return (
    permission ===
    "SUPER_ADMIN"
  );
}

export async function requireAdminAccess(
  userId: string,
  capability:
    AdminCapability = "REVIEW",
) {
  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        accountStatus: true,

        adminAccess: {
          select: {
            permission: true,
            revokedAt: true,
          },
        },
      },
    });

  if (
    !user ||
    user.accountStatus !==
      "ACTIVE" ||
    !user.adminAccess ||
    user.adminAccess.revokedAt
  ) {
    throw new AdminForbiddenError();
  }

  if (
    !adminPermissionHasCapability(
      user.adminAccess.permission,
      capability,
    )
  ) {
    throw new AdminForbiddenError();
  }

  return {
    userId,
    permission:
      user.adminAccess.permission,
  };
}

export async function getCurrentAdminCapabilities(
  userId: string,
) {
  const admin =
    await requireAdminAccess(
      userId,
    );

  const isSuperAdmin =
    admin.permission ===
    "SUPER_ADMIN";

  return {
    userId,
    permission:
      admin.permission,

    capabilities: {
      reviewTeacherApplications:
        true,

      moderateTeachers:
        isSuperAdmin,

      moderateAccounts:
        isSuperAdmin,

      manageAdminAccess:
        isSuperAdmin,

      manageSessions:
        isSuperAdmin,
    },
  };
}
