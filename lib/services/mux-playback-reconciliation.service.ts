import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { getMuxClient } from "@/lib/video/mux-client";

const LEASE_SECONDS = 60;
const MAX_BACKOFF_SECONDS = 3600;
const TERMINAL_REVERIFY_SECONDS = 300;

const OPERATIONAL_OVERDUE_SECONDS = 15 * 60;
const DURABLE_FAILURE_ATTEMPTS = 5;

const RECONCILIATION_ACTIVE_STATUSES = [
  "PENDING",
  "FAILED",
  "PROCESSING",
  "SUCCEEDED",
] as const;

type PlaybackIntentInput = {
  introVideoId: string;
  videoRevision: number;
  assetId: string;
  playbackId?: string | null;
  desiredState: "ENABLED" | "REVOKED";
};

export async function queueMuxPlaybackIntent(tx: Prisma.TransactionClient, input: PlaybackIntentInput) {
  return tx.muxPlaybackReconciliation.upsert({
    where: { introVideoId_videoRevision: { introVideoId: input.introVideoId, videoRevision: input.videoRevision } },
    create: { ...input, status: "PENDING", nextAttemptAt: new Date() },
    update: {
      assetId: input.assetId,
      playbackId: input.playbackId ?? undefined,
      desiredState: input.desiredState,
      intentGeneration: { increment: 1 },
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: new Date(),
      leaseToken: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
    },
  });
}

function providerErrorCode(error: unknown): string {
  return error instanceof Error && error.name ? `MUX_${error.name.toUpperCase()}`.slice(0, 120) : "MUX_PROVIDER_ERROR";
}

function isProviderNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && (error as { status?: unknown }).status === 404;
}

async function listPublicPlaybackIds(assetId: string, allowMissingAsset: boolean) {
  try {
    const asset = await getMuxClient().video.assets.retrieve(assetId);
    return (asset.playback_ids ?? []).filter((item) => item.policy === "public").map((item) => item.id);
  } catch (error) {
    if (allowMissingAsset && isProviderNotFound(error)) return [];
    throw error;
  }
}

function backoffDate(attemptCount: number) {
  const seconds = Math.min(MAX_BACKOFF_SECONDS, 30 * 2 ** Math.max(0, attemptCount - 1));
  return new Date(Date.now() + seconds * 1000);
}

function terminalReverifyDate() {
  return new Date(Date.now() + TERMINAL_REVERIFY_SECONDS * 1000);
}

type ClaimedReconciliation = Prisma.MuxPlaybackReconciliationGetPayload<{
  include: { introVideo: { select: { id: true; revision: true; status: true; teacherProfile: { select: { applicationStatus: true; profileCompletedAt: true; user: { select: { accountStatus: true } } } } } } };
}>;

async function claimReconciliation(id: string, force: boolean): Promise<ClaimedReconciliation | null> {
  const current = await prisma.muxPlaybackReconciliation.findUnique({ where: { id }, select: { intentGeneration: true, nextAttemptAt: true } });
  if (!current || (!force && current.nextAttemptAt > new Date())) return null;
  const now = new Date();
  const leaseToken = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_SECONDS * 1000);
  const claimed = await prisma.muxPlaybackReconciliation.updateMany({
    where: {
      id,
      intentGeneration: current.intentGeneration,
      ...(force ? {} : { nextAttemptAt: { lte: now } }),
      status: { in: ["PENDING", "FAILED", "PROCESSING", "SUCCEEDED"] },
      OR: [{ leaseToken: null }, { leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
    },
    data: { status: "PROCESSING", attemptCount: { increment: 1 }, lastAttemptAt: now, leaseToken, leaseExpiresAt, lastErrorCode: null },
  });
  if (claimed.count !== 1) return null;
  const record = await prisma.muxPlaybackReconciliation.findUnique({
    where: { id },
    include: { introVideo: { select: { id: true, revision: true, status: true, teacherProfile: { select: { applicationStatus: true, profileCompletedAt: true, user: { select: { accountStatus: true } } } } } } },
  });
  if (!record || record.intentGeneration !== current.intentGeneration || record.leaseToken !== leaseToken) return null;
  return record;
}

async function finalizeEnabled(record: ClaimedReconciliation, playbackId: string) {
  return prisma.$transaction(async (tx) => {
    const finalized = await tx.muxPlaybackReconciliation.updateMany({
      where: { id: record.id, intentGeneration: record.intentGeneration, videoRevision: record.videoRevision, leaseToken: record.leaseToken, status: "PROCESSING" },
      data: { playbackId, status: "SUCCEEDED", attemptCount: 0, nextAttemptAt: terminalReverifyDate(), leaseToken: null, leaseExpiresAt: null, lastErrorCode: null },
    });
    if (finalized.count !== 1) return false;
    const video = await tx.teacherIntroVideo.updateMany({
      where: { id: record.introVideoId, revision: record.videoRevision, status: "APPROVED", teacherProfile: { applicationStatus: "APPROVED", profileCompletedAt: { not: null }, user: { accountStatus: "ACTIVE" } } },
      data: { publicPlaybackId: playbackId },
    });
    if (video.count !== 1) throw new Error("PUBLIC_ELIGIBILITY_CHANGED");
    return true;
  });
}

async function finalizeRevoked(record: ClaimedReconciliation, discoveredIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const finalized = await tx.muxPlaybackReconciliation.updateMany({
      where: { id: record.id, intentGeneration: record.intentGeneration, videoRevision: record.videoRevision, leaseToken: record.leaseToken, status: "PROCESSING" },
      data: { playbackId: null, status: "SUCCEEDED", attemptCount: 0, nextAttemptAt: terminalReverifyDate(), leaseToken: null, leaseExpiresAt: null, lastErrorCode: null },
    });
    if (finalized.count !== 1) return false;
    const knownIds = [...new Set([record.playbackId, ...discoveredIds].filter((value): value is string => Boolean(value)))];
    if (knownIds.length > 0) {
      await tx.teacherIntroVideo.updateMany({ where: { id: record.introVideoId, publicPlaybackId: { in: knownIds } }, data: { publicPlaybackId: null } });
    }
    return true;
  });
}

async function markFailed(record: ClaimedReconciliation, error: unknown) {
  const failed = await prisma.muxPlaybackReconciliation.updateMany({
    where: { id: record.id, intentGeneration: record.intentGeneration, leaseToken: record.leaseToken, status: "PROCESSING" },
    data: { status: "FAILED", nextAttemptAt: backoffDate(record.attemptCount), leaseToken: null, leaseExpiresAt: null, lastErrorCode: providerErrorCode(error) },
  });
  return failed.count === 1;
}

async function renewReconciliationLease(record: ClaimedReconciliation) {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_SECONDS * 1000);

  const renewed = await prisma.muxPlaybackReconciliation.updateMany({
    where: {
      id: record.id,
      intentGeneration: record.intentGeneration,
      videoRevision: record.videoRevision,
      leaseToken: record.leaseToken,
      status: "PROCESSING",
      leaseExpiresAt: { gt: now },
    },
    data: {
      leaseExpiresAt,
    },
  });

  return renewed.count === 1;
}

export async function reconcileMuxPlayback(reconciliationId: string, options: { force?: boolean } = {}) {
  const record = await claimReconciliation(reconciliationId, options.force ?? false);
  if (!record) return { outcome: "SKIPPED" as const };
  try {
    if (record.desiredState === "ENABLED") {
      const eligible = record.introVideo.revision === record.videoRevision
        && record.introVideo.status === "APPROVED"
        && record.introVideo.teacherProfile.applicationStatus === "APPROVED"
        && record.introVideo.teacherProfile.profileCompletedAt !== null
        && record.introVideo.teacherProfile.user.accountStatus === "ACTIVE";
      if (!eligible) {
        const changed = await prisma.muxPlaybackReconciliation.updateMany({
          where: { id: record.id, intentGeneration: record.intentGeneration, leaseToken: record.leaseToken },
          data: { desiredState: "REVOKED", intentGeneration: { increment: 1 }, status: "PENDING", nextAttemptAt: new Date(), leaseToken: null, leaseExpiresAt: null, lastErrorCode: "PUBLIC_ELIGIBILITY_WITHDRAWN" },
        });
        return { outcome: changed.count === 1 ? "REQUEUED" as const : "SKIPPED" as const };
      }
      const publicIds = await listPublicPlaybackIds(record.assetId, false);
      let playbackId = publicIds.find((id) => id === record.playbackId) ?? publicIds[0];
      if (!playbackId) {
        if (!(await renewReconciliationLease(record))) {
          return { outcome: "SKIPPED" as const };
        }

        playbackId = (
          await getMuxClient().video.assets.createPlaybackId(record.assetId, {
            policy: "public",
          })
        ).id;
      }
      for (const duplicateId of publicIds.filter((id) => id !== playbackId)) {
        if (!(await renewReconciliationLease(record))) {
          return { outcome: "SKIPPED" as const };
        }


        try {
          await getMuxClient().video.assets.deletePlaybackId(
            record.assetId,
            duplicateId,
          );
        } catch (error) {
          if (!isProviderNotFound(error)) throw error;
        }
      }
      const finalized = await finalizeEnabled(record, playbackId);
      if (finalized) return { outcome: "SUCCEEDED" as const };
      return { outcome: "SKIPPED" as const };
    }

    const publicIds = await listPublicPlaybackIds(record.assetId, true);
    const idsToDelete = [...new Set([record.playbackId, ...publicIds].filter((value): value is string => Boolean(value)))];
    for (const playbackId of idsToDelete) {
      if (!(await renewReconciliationLease(record))) {
        return { outcome: "SKIPPED" as const };
      }


      try {
        await getMuxClient().video.assets.deletePlaybackId(
          record.assetId,
          playbackId,
        );
      } catch (error) {
        if (!isProviderNotFound(error)) throw error;
      }
    }
    const finalized = await finalizeRevoked(record, publicIds);
    if (finalized) return { outcome: "SUCCEEDED" as const };
    return { outcome: "SKIPPED" as const };
  } catch (error) {
    const markedFailed = await markFailed(record, error);

    if (markedFailed) {
      return { outcome: "FAILED" as const };
    }
    return { outcome: "SKIPPED" as const };
  }
}

export async function processDueMuxPlaybackReconciliations(limit = 20) {
  const boundedLimit = Math.max(1, Math.min(50, limit));
  const now = new Date();
  const candidates = await prisma.muxPlaybackReconciliation.findMany({
    where: {
      nextAttemptAt: { lte: now },
      status: { in: ["PENDING", "FAILED", "PROCESSING", "SUCCEEDED"] },
      OR: [{ leaseToken: null }, { leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
    },
    orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
    take: boundedLimit,
    select: { id: true },
  });
  const counts = { selected: candidates.length, succeeded: 0, failed: 0, requeued: 0, skipped: 0 };
  for (const candidate of candidates) {
    try {
      const result = await reconcileMuxPlayback(candidate.id);
      if (result.outcome === "SUCCEEDED") counts.succeeded += 1;
      else if (result.outcome === "FAILED") counts.failed += 1;
      else if (result.outcome === "REQUEUED") counts.requeued += 1;
      else counts.skipped += 1;
    } catch {
      counts.failed += 1;
    }
  }
  return counts;
}

export type MuxPlaybackReconciliationOperationalHealth = {
  status: "HEALTHY" | "DEGRADED";
  sampledAt: string;
  due: number;
  overdue: number;
  durableFailures: number;
  oldestDueAt: string | null;
  thresholds: {
    overdueSeconds: number;
    durableFailureAttempts: number;
  };
};

export async function getMuxPlaybackReconciliationOperationalHealth(
  now = new Date(),
): Promise<MuxPlaybackReconciliationOperationalHealth> {
  const overdueBefore = new Date(
    now.getTime() - OPERATIONAL_OVERDUE_SECONDS * 1000,
  );

  const [due, overdue, durableFailures, oldestDue] = await Promise.all([
    prisma.muxPlaybackReconciliation.count({
      where: {
        nextAttemptAt: { lte: now },
        status: { in: [...RECONCILIATION_ACTIVE_STATUSES] },
      },
    }),
    prisma.muxPlaybackReconciliation.count({
      where: {
        nextAttemptAt: { lte: overdueBefore },
        status: { in: [...RECONCILIATION_ACTIVE_STATUSES] },
      },
    }),
    prisma.muxPlaybackReconciliation.count({
      where: {
        status: "FAILED",
        attemptCount: { gte: DURABLE_FAILURE_ATTEMPTS },
      },
    }),
    prisma.muxPlaybackReconciliation.findFirst({
      where: {
        nextAttemptAt: { lte: now },
        status: { in: [...RECONCILIATION_ACTIVE_STATUSES] },
      },
      orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
      select: { nextAttemptAt: true },
    }),
  ]);

  return {
    status: overdue > 0 || durableFailures > 0 ? "DEGRADED" : "HEALTHY",
    sampledAt: now.toISOString(),
    due,
    overdue,
    durableFailures,
    oldestDueAt: oldestDue?.nextAttemptAt.toISOString() ?? null,
    thresholds: {
      overdueSeconds: OPERATIONAL_OVERDUE_SECONDS,
      durableFailureAttempts: DURABLE_FAILURE_ATTEMPTS,
    },
  };
}
