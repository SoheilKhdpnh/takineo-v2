import "server-only";

import { requireAdminAccess } from "@/lib/auth/admin-access";
import { prisma } from "@/lib/db/prisma";
import { AdminReviewConflictError, AdminTargetNotFoundError } from "@/lib/errors/admin-errors";
import type { Prisma } from "@/lib/generated/prisma/client";
import { reconcileMuxPlayback } from "@/lib/services/mux-playback-reconciliation.service";

async function assertNotLastActiveSuperAdmin(
  tx: Prisma.TransactionClient,
  targetUserId: string,
) {
  const target = await tx.adminAccess.findUnique({ where: { userId: targetUserId }, select: { permission: true, revokedAt: true, user: { select: { accountStatus: true } } } });
  if (target?.permission !== "SUPER_ADMIN" || target.revokedAt || target.user.accountStatus !== "ACTIVE") return;
  const activeSuperAdmins = await tx.adminAccess.count({ where: { permission: "SUPER_ADMIN", revokedAt: null, user: { accountStatus: "ACTIVE" } } });
  if (activeSuperAdmins <= 1) throw new AdminReviewConflictError();
}

export async function setAdministrativeAccess(actorUserId: string, targetUserId: string, permission: "REVIEWER" | "SUPER_ADMIN" | null) {
  await requireAdminAccess(actorUserId, "MODERATE_TEACHER");
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: targetUserId }, select: { accountStatus: true, adminAccess: true } });
    if (!target) throw new AdminTargetNotFoundError();
    if (target.accountStatus !== "ACTIVE" && permission) throw new AdminReviewConflictError();
    const previousPermission = target.adminAccess?.revokedAt ? null : target.adminAccess?.permission ?? null;
    if (previousPermission === permission) throw new AdminReviewConflictError();
    if (previousPermission === "SUPER_ADMIN" && permission !== "SUPER_ADMIN") await assertNotLastActiveSuperAdmin(tx, targetUserId);
    const access = permission
      ? await tx.adminAccess.upsert({ where: { userId: targetUserId }, create: { userId: targetUserId, permission }, update: { permission, revokedAt: null } })
      : target.adminAccess ? await tx.adminAccess.update({ where: { userId: targetUserId }, data: { revokedAt: new Date() } }) : null;
    await tx.adminAuditEvent.create({ data: { actorUserId, targetUserId, action: !permission ? "ADMIN_ACCESS_REVOKED" : previousPermission ? "ADMIN_PERMISSION_CHANGED" : "ADMIN_ACCESS_GRANTED", metadata: { previousPermission, newPermission: permission } } });
    return access;
  }, { isolationLevel: "Serializable" });
}

export async function setAccountStatus(actorUserId: string, targetUserId: string, accountStatus: "ACTIVE" | "SUSPENDED" | "DISABLED", reason: string) {
  await requireAdminAccess(actorUserId, "MODERATE_TEACHER");
  const reconciliationId = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: targetUserId }, select: { accountStatus: true, teacherProfile: { select: { applicationStatus: true, profileCompletedAt: true, introVideo: { select: { id: true, revision: true, status: true, assetId: true, publicPlaybackId: true } } } } } });
    if (!target) throw new AdminTargetNotFoundError();
    if (target.accountStatus === accountStatus) throw new AdminReviewConflictError();
    if (accountStatus !== "ACTIVE") await assertNotLastActiveSuperAdmin(tx, targetUserId);
    const changed = await tx.user.updateMany({ where: { id: targetUserId, accountStatus: target.accountStatus }, data: { accountStatus } });
    if (changed.count !== 1) throw new AdminReviewConflictError();
    let reconciliationId: string | null = null;
    const video = target.teacherProfile?.introVideo;
    if (video?.assetId) {
      const eligible = accountStatus === "ACTIVE" && target.teacherProfile?.applicationStatus === "APPROVED" && target.teacherProfile.profileCompletedAt !== null && video.status === "APPROVED";
      const reconciliation = await tx.muxPlaybackReconciliation.upsert({ where: { introVideoId_videoRevision: { introVideoId: video.id, videoRevision: video.revision } }, create: { introVideoId: video.id, videoRevision: video.revision, assetId: video.assetId, playbackId: video.publicPlaybackId, desiredState: eligible ? "ENABLED" : "REVOKED", status: "PENDING" }, update: { playbackId: video.publicPlaybackId ?? undefined, desiredState: eligible ? "ENABLED" : "REVOKED", status: "PENDING", lastErrorCode: null } });
      reconciliationId = reconciliation.id;
    }
    await tx.adminAuditEvent.create({ data: { actorUserId, targetUserId, action: "ACCOUNT_STATUS_CHANGED", reason, metadata: { previousAccountStatus: target.accountStatus, newAccountStatus: accountStatus } } });
    return reconciliationId;
  }, { isolationLevel: "Serializable" });
  if (reconciliationId) await reconcileMuxPlayback(reconciliationId);
  return { id: targetUserId, accountStatus };
}
