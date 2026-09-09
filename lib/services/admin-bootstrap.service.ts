import "server-only";

import { AdminReviewConflictError, AdminTargetNotFoundError } from "@/lib/errors/admin-errors";
import { runSerializableAdminTransaction } from "@/lib/services/admin-transaction";

const BOOTSTRAP_CONFIRMATION = "BOOTSTRAP_INITIAL_SUPER_ADMIN";

/** Privileged non-route entry point for an operator-controlled script/console. */
export async function bootstrapInitialSuperAdmin(input: { userId: string; confirmation: string }) {
  if (input.confirmation !== BOOTSTRAP_CONFIRMATION) throw new AdminReviewConflictError();
  return runSerializableAdminTransaction(async (tx) => {
    const [user, activeAdmins] = await Promise.all([
      tx.user.findUnique({ where: { id: input.userId }, select: { id: true, accountStatus: true } }),
      tx.adminAccess.count({ where: { revokedAt: null } }),
    ]);
    if (!user) throw new AdminTargetNotFoundError();
    if (user.accountStatus !== "ACTIVE" || activeAdmins !== 0) throw new AdminReviewConflictError();
    const access = await tx.adminAccess.create({ data: { userId: user.id, permission: "SUPER_ADMIN" } });
    await tx.adminAuditEvent.create({ data: { actorUserId: user.id, targetUserId: user.id, action: "ADMIN_BOOTSTRAPPED", metadata: { permission: "SUPER_ADMIN" } } });
    return access;
  });
}
