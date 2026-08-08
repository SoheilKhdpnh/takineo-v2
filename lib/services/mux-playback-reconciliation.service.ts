import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getMuxClient } from "@/lib/video/mux-client";

function providerErrorCode(error: unknown): string {
  return error instanceof Error && error.name ? `MUX_${error.name.toUpperCase()}`.slice(0, 120) : "MUX_PROVIDER_ERROR";
}

function isProviderNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && (error as { status?: unknown }).status === 404;
}

export async function reconcileMuxPlayback(reconciliationId: string) {
  const record = await prisma.muxPlaybackReconciliation.findUnique({
    where: { id: reconciliationId },
    include: { introVideo: { select: { id: true, revision: true, publicPlaybackId: true, status: true, teacherProfile: { select: { applicationStatus: true, profileCompletedAt: true, user: { select: { accountStatus: true } } } } } } },
  });
  if (!record) return null;
  const claimed = await prisma.muxPlaybackReconciliation.updateMany({
    where: { id: record.id, updatedAt: record.updatedAt, status: { in: ["PENDING", "FAILED", "PROCESSING"] } },
    data: { status: "PROCESSING", attemptCount: { increment: 1 }, lastAttemptAt: new Date(), lastErrorCode: null },
  });
  if (claimed.count !== 1) return prisma.muxPlaybackReconciliation.findUnique({ where: { id: record.id } });

  try {
    if (record.desiredState === "ENABLED") {
      const eligible = record.introVideo.revision === record.videoRevision
        && record.introVideo.status === "APPROVED"
        && record.introVideo.teacherProfile.applicationStatus === "APPROVED"
        && record.introVideo.teacherProfile.profileCompletedAt !== null
        && record.introVideo.teacherProfile.user.accountStatus === "ACTIVE";
      if (!eligible) {
        await prisma.muxPlaybackReconciliation.update({ where: { id: record.id }, data: { desiredState: "REVOKED", status: "PENDING", lastErrorCode: "PUBLIC_ELIGIBILITY_WITHDRAWN" } });
        return reconcileMuxPlayback(record.id);
      }
      const mux = getMuxClient();
      const asset = await mux.video.assets.retrieve(record.assetId);
      const publicIds = asset.playback_ids?.filter((item) => item.policy === "public") ?? [];
      const existingPublicId = publicIds.find((item) => item.id === record.playbackId)?.id ?? publicIds[0]?.id;
      const playbackId = existingPublicId ?? (await mux.video.assets.createPlaybackId(record.assetId, { policy: "public" })).id;
      await prisma.muxPlaybackReconciliation.update({ where: { id: record.id }, data: { playbackId } });
      try {
        await prisma.$transaction(async (tx) => {
          const stillEligible = await tx.teacherIntroVideo.updateMany({
            where: { id: record.introVideoId, revision: record.videoRevision, status: "APPROVED", teacherProfile: { applicationStatus: "APPROVED", profileCompletedAt: { not: null }, user: { accountStatus: "ACTIVE" } } },
            data: { publicPlaybackId: playbackId },
          });
          if (stillEligible.count !== 1) throw new Error("PUBLIC_ELIGIBILITY_CHANGED");
          await tx.muxPlaybackReconciliation.update({ where: { id: record.id }, data: { playbackId, status: "SUCCEEDED", lastErrorCode: null } });
        });
      } catch (error) {
        await prisma.muxPlaybackReconciliation.updateMany({ where: { id: record.id }, data: { desiredState: "REVOKED", status: "PENDING", lastErrorCode: "PUBLIC_ELIGIBILITY_CHANGED_AFTER_CREATE" } });
        throw error;
      }
    } else {
      if (record.playbackId) {
        try { await getMuxClient().video.assets.deletePlaybackId(record.assetId, record.playbackId); }
        catch (error) { if (!isProviderNotFound(error)) throw error; }
      }
      await prisma.$transaction(async (tx) => {
        if (record.playbackId) {
          await tx.teacherIntroVideo.updateMany({ where: { id: record.introVideoId, publicPlaybackId: record.playbackId }, data: { publicPlaybackId: null } });
        }
        await tx.muxPlaybackReconciliation.update({ where: { id: record.id }, data: { playbackId: null, status: "SUCCEEDED", lastErrorCode: null } });
      });
    }
  } catch (error) {
    await prisma.muxPlaybackReconciliation.updateMany({ where: { id: record.id, status: "PROCESSING" }, data: { status: "FAILED", lastErrorCode: providerErrorCode(error) } });
  }
  return prisma.muxPlaybackReconciliation.findUnique({ where: { id: record.id } });
}

export async function reconcilePendingMuxPlaybacks(limit = 20) {
  const staleProcessingBefore = new Date(Date.now() - 5 * 60 * 1000);
  const records = await prisma.muxPlaybackReconciliation.findMany({
    where: { OR: [{ status: { in: ["PENDING", "FAILED"] } }, { status: "PROCESSING", lastAttemptAt: { lt: staleProcessingBefore } }] }, orderBy: { updatedAt: "asc" }, take: limit, select: { id: true },
  });
  return Promise.all(records.map((record) => reconcileMuxPlayback(record.id)));
}
