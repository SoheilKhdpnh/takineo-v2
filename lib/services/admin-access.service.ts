import "server-only";

import { requireAdminAccess } from "@/lib/auth/admin-access";
import { prisma } from "@/lib/db/prisma";
import { AdminReviewConflictError, AdminReviewProviderError, AdminTargetNotFoundError } from "@/lib/errors/admin-errors";
import { getMuxClient } from "@/lib/video/mux-client";

export async function setAdministrativeAccess(actorUserId: string, targetUserId: string, permission: "REVIEWER" | "SUPER_ADMIN" | null) {
  await requireAdminAccess(actorUserId, "MODERATE_TEACHER");
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: targetUserId }, select: { accountStatus: true, adminAccess: true } });
    if (!target) throw new AdminTargetNotFoundError();
    if (target.accountStatus !== "ACTIVE" && permission) throw new AdminReviewConflictError();
    const previousPermission = target.adminAccess?.revokedAt ? null : target.adminAccess?.permission ?? null;
    if (previousPermission === permission) throw new AdminReviewConflictError();
    const access = permission
      ? await tx.adminAccess.upsert({ where: { userId: targetUserId }, create: { userId: targetUserId, permission }, update: { permission, revokedAt: null } })
      : target.adminAccess
        ? await tx.adminAccess.update({ where: { userId: targetUserId }, data: { revokedAt: new Date() } })
        : null;
    await tx.adminAuditEvent.create({ data: { actorUserId, targetUserId, action: !permission ? "ADMIN_ACCESS_REVOKED" : previousPermission ? "ADMIN_PERMISSION_CHANGED" : "ADMIN_ACCESS_GRANTED", metadata: { previousPermission, newPermission: permission } } });
    return access;
  });
}

export async function setAccountStatus(actorUserId: string, targetUserId: string, accountStatus: "ACTIVE" | "SUSPENDED" | "DISABLED", reason: string) {
  await requireAdminAccess(actorUserId, "MODERATE_TEACHER");
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { accountStatus: true, teacherProfile: { select: { introVideo: { select: { id: true, assetId: true, publicPlaybackId: true } } } } } });
  if (!target) throw new AdminTargetNotFoundError();
  if (target.accountStatus === accountStatus) throw new AdminReviewConflictError();
  const video = target.teacherProfile?.introVideo;
  if (accountStatus !== "ACTIVE" && video?.assetId && video.publicPlaybackId) {
    try { await getMuxClient().video.assets.deletePlaybackId(video.assetId, video.publicPlaybackId); }
    catch { throw new AdminReviewProviderError(); }
  }
  return prisma.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({ where: { id: targetUserId, accountStatus: target.accountStatus }, data: { accountStatus } });
    if (changed.count !== 1) throw new AdminReviewConflictError();
    if (accountStatus !== "ACTIVE" && video?.publicPlaybackId) {
      await tx.teacherIntroVideo.updateMany({ where: { id: video.id, publicPlaybackId: video.publicPlaybackId }, data: { publicPlaybackId: null } });
    }
    await tx.adminAuditEvent.create({ data: { actorUserId, targetUserId, action: "ACCOUNT_STATUS_CHANGED", reason, metadata: { previousAccountStatus: target.accountStatus, newAccountStatus: accountStatus } } });
    return { id: targetUserId, accountStatus };
  });
}
