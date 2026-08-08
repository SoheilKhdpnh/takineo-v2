import "server-only";

import { requireAdminAccess } from "@/lib/auth/admin-access";
import { prisma } from "@/lib/db/prisma";
import { ADMIN_REVIEW_PLAYBACK_TTL_SECONDS, rejectionIncludesProfile, rejectionIncludesVideo } from "@/lib/domain/admin-review";
import { AdminForbiddenError, AdminReviewConflictError, AdminReviewProviderError, AdminTargetNotFoundError } from "@/lib/errors/admin-errors";
import { Prisma } from "@/lib/generated/prisma/client";
import { queueMuxPlaybackIntent, reconcileMuxPlayback } from "@/lib/services/mux-playback-reconciliation.service";
import { getMuxClient } from "@/lib/video/mux-client";
import { getMuxSigningConfiguration } from "@/lib/video/mux-config";
import { cleanupMuxReviewPlayback } from "@/lib/video/mux-review-playback";
import { runSerializableAdminTransaction } from "@/lib/services/admin-transaction";

const reviewDetailSelect = {
  id: true, userId: true, headline: true, bio: true, experienceYears: true,
  nativeLanguage: true, teachingLanguage: true, timezone: true, profileCompletedAt: true, profileRevision: true,
  applicationStatus: true, applicationSubmittedAt: true, applicationReviewedAt: true, applicationReviewNote: true,
  reviewCycle: true, submittedProfileRevision: true, submittedVideoId: true, submittedVideoRevision: true,
  submittedVideoUploadId: true, submittedVideoAssetId: true, createdAt: true, updatedAt: true,
  user: { select: { id: true, name: true, email: true, accountStatus: true } },
  introVideo: { select: { id: true, provider: true, uploadId: true, assetId: true, publicPlaybackId: true, revision: true, status: true, durationSeconds: true, rejectionReason: true, submittedAt: true, reviewedAt: true, createdAt: true, updatedAt: true, playbackReconciliations: { orderBy: { createdAt: "desc" as const }, take: 1, select: { videoRevision: true, desiredState: true, intentGeneration: true, status: true, attemptCount: true, nextAttemptAt: true, leaseExpiresAt: true, lastErrorCode: true, lastAttemptAt: true } } } },
} satisfies Prisma.TeacherProfileSelect;

type ReviewGuard = { reviewCycle: number; profileRevision: number; videoId: string; videoRevision: number };

export async function listPendingTeacherApplications(actorUserId: string, input: { cursor?: string; limit: number }) {
  await requireAdminAccess(actorUserId);
  const rows = await prisma.teacherProfile.findMany({
    where: { applicationStatus: "PENDING_REVIEW" }, orderBy: [{ applicationSubmittedAt: "asc" }, { id: "asc" }], take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: { id: true, reviewCycle: true, submittedProfileRevision: true, submittedVideoId: true, submittedVideoRevision: true, applicationSubmittedAt: true, user: { select: { name: true, email: true, accountStatus: true } }, introVideo: { select: { id: true, revision: true, status: true, durationSeconds: true } } },
  });
  const hasMore = rows.length > input.limit;
  const applications = hasMore ? rows.slice(0, input.limit) : rows;
  return { applications, nextCursor: hasMore ? applications.at(-1)?.id ?? null : null };
}

export async function getAdminTeacherApplication(actorUserId: string, applicationId: string) {
  await requireAdminAccess(actorUserId);
  return loadAdminTeacherApplication(applicationId);
}

async function loadAdminTeacherApplication(applicationId: string) {
  const application = await prisma.teacherProfile.findUnique({ where: { id: applicationId }, select: reviewDetailSelect });
  if (!application) throw new AdminTargetNotFoundError();
  return application;
}

async function getPendingReviewTarget(applicationId: string) {
  const application = await prisma.teacherProfile.findUnique({ where: { id: applicationId }, select: reviewDetailSelect });
  if (!application) throw new AdminTargetNotFoundError();
  const video = application.introVideo;
  if (application.applicationStatus !== "PENDING_REVIEW" || !video
    || application.reviewCycle < 1 || application.submittedProfileRevision === null
    || application.submittedVideoRevision === null || application.submittedVideoUploadId === null
    || application.submittedVideoAssetId === null || video.provider !== "mux" || video.uploadId === null || video.assetId === null
    || application.submittedProfileRevision !== application.profileRevision
    || application.submittedVideoId !== video.id || application.submittedVideoRevision !== video.revision
    || application.submittedVideoUploadId !== video.uploadId || application.submittedVideoAssetId !== video.assetId) {
    throw new AdminReviewConflictError();
  }
  return application;
}

function matchesGuard(application: Awaited<ReturnType<typeof getPendingReviewTarget>>, input: ReviewGuard) {
  return application.reviewCycle === input.reviewCycle && application.submittedProfileRevision === input.profileRevision
    && application.submittedVideoId === input.videoId && application.submittedVideoRevision === input.videoRevision;
}

function auditSnapshot(application: Awaited<ReturnType<typeof getPendingReviewTarget>>) {
  return { profileRevision: application.submittedProfileRevision!, videoRevision: application.submittedVideoRevision!, reviewedUploadId: application.submittedVideoUploadId!, reviewedAssetId: application.submittedVideoAssetId! };
}

export async function createAdminReviewPlayback(actorUserId: string, applicationId: string) {
  await requireAdminAccess(actorUserId);
  const application = await getPendingReviewTarget(applicationId);
  const video = application.introVideo!;
  if (!video.assetId || !["READY_FOR_REVIEW", "APPROVED"].includes(video.status)) throw new AdminReviewConflictError();
  try {
    const mux = getMuxClient();
    let playbackId = await prisma.teacherIntroVideo.findUnique({ where: { id: video.id }, select: { reviewPlaybackId: true } }).then((row) => row?.reviewPlaybackId ?? null);
    if (!playbackId) {
      const created = await mux.video.assets.createPlaybackId(video.assetId, { policy: "signed" });
      const saved = await prisma.teacherIntroVideo.updateMany({ where: { id: video.id, revision: video.revision, assetId: video.assetId, reviewPlaybackId: null }, data: { reviewPlaybackId: created.id } });
      if (saved.count === 1) playbackId = created.id;
      else {
        await mux.video.assets.deletePlaybackId(video.assetId, created.id).catch(() => undefined);
        playbackId = await prisma.teacherIntroVideo.findUnique({ where: { id: video.id }, select: { reviewPlaybackId: true } }).then((row) => row?.reviewPlaybackId ?? null);
      }
    }
    if (!playbackId) throw new AdminReviewProviderError();
    const signing = getMuxSigningConfiguration();
    const token = await mux.jwt.signPlaybackId(playbackId, { type: "video", expiration: `${ADMIN_REVIEW_PLAYBACK_TTL_SECONDS}s`, keyId: signing.keyId, keySecret: signing.privateKey });
    await requireAdminAccess(actorUserId);
    const stillReviewable = await prisma.teacherProfile.count({
      where: { id: application.id, applicationStatus: "PENDING_REVIEW", reviewCycle: application.reviewCycle, profileRevision: application.profileRevision, submittedProfileRevision: application.submittedProfileRevision, submittedVideoId: video.id, submittedVideoRevision: video.revision, submittedVideoUploadId: video.uploadId, submittedVideoAssetId: video.assetId, introVideo: { is: { id: video.id, provider: "mux", revision: video.revision, uploadId: video.uploadId, assetId: video.assetId, status: { in: ["READY_FOR_REVIEW", "APPROVED"] } } } },
    });
    if (stillReviewable !== 1) {
      await cleanupMuxReviewPlayback({ videoId: video.id, videoRevision: video.revision, assetId: video.assetId, playbackId });
      throw new AdminReviewConflictError();
    }
    return { playbackId, token, expiresInSeconds: ADMIN_REVIEW_PLAYBACK_TTL_SECONDS };
  } catch (error) {
    if (error instanceof AdminForbiddenError || error instanceof AdminReviewProviderError || error instanceof AdminReviewConflictError) throw error;
    throw new AdminReviewProviderError();
  }
}

export async function approveTeacherApplication(actorUserId: string, applicationId: string, input: ReviewGuard) {
  await requireAdminAccess(actorUserId);
  const application = await getPendingReviewTarget(applicationId);
  const video = application.introVideo!;
  if (!matchesGuard(application, input) || !["READY_FOR_REVIEW", "APPROVED"].includes(video.status) || !video.assetId || !application.profileCompletedAt) throw new AdminReviewConflictError();
  const reviewPlaybackId = await prisma.teacherIntroVideo.findUnique({ where: { id: video.id }, select: { reviewPlaybackId: true } }).then((row) => row?.reviewPlaybackId ?? null);
  const reconciliationId = await runSerializableAdminTransaction(async (tx) => {
    const videoUpdate = await tx.teacherIntroVideo.updateMany({ where: { id: video.id, revision: input.videoRevision, uploadId: application.submittedVideoUploadId, assetId: application.submittedVideoAssetId, status: { in: ["READY_FOR_REVIEW", "APPROVED"] } }, data: { status: "APPROVED", reviewedAt: new Date(), rejectionReason: null } });
    const profileUpdate = await tx.teacherProfile.updateMany({ where: { id: application.id, applicationStatus: "PENDING_REVIEW", reviewCycle: input.reviewCycle, profileRevision: input.profileRevision, submittedProfileRevision: input.profileRevision, submittedVideoId: input.videoId, submittedVideoRevision: input.videoRevision, submittedVideoUploadId: application.submittedVideoUploadId, submittedVideoAssetId: application.submittedVideoAssetId, user: { accountStatus: "ACTIVE" } }, data: { applicationStatus: "APPROVED", applicationReviewedAt: new Date(), applicationReviewNote: null } });
    if (videoUpdate.count !== 1 || profileUpdate.count !== 1) throw new AdminReviewConflictError();
    const reconciliation = await queueMuxPlaybackIntent(tx, { introVideoId: video.id, videoRevision: video.revision, assetId: video.assetId!, desiredState: "ENABLED" });
    const snapshot = auditSnapshot(application);
    await tx.adminAuditEvent.createMany({ data: [
      { actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "PROFILE_APPROVED", reviewCycle: input.reviewCycle, ...snapshot, metadata: { reviewedProfileRevision: input.profileRevision } },
      { actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "VIDEO_APPROVED", reviewCycle: input.reviewCycle, ...snapshot, metadata: { previousVideoStatus: video.status, newVideoStatus: "APPROVED" } },
      { actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "APPLICATION_APPROVED", reviewCycle: input.reviewCycle, ...snapshot, metadata: { previousApplicationStatus: "PENDING_REVIEW", newApplicationStatus: "APPROVED", previousVideoStatus: video.status, newVideoStatus: "APPROVED" } },
    ] });
    return reconciliation.id;
  });
  await reconcileMuxPlayback(reconciliationId);
  await cleanupMuxReviewPlayback({ videoId: video.id, videoRevision: video.revision, assetId: video.assetId, playbackId: reviewPlaybackId });
  return loadAdminTeacherApplication(applicationId);
}

export async function rejectTeacherApplication(actorUserId: string, applicationId: string, input: ReviewGuard & { target: "PROFILE" | "VIDEO" | "BOTH"; profileReason?: string; videoReason?: string }) {
  await requireAdminAccess(actorUserId);
  const application = await getPendingReviewTarget(applicationId);
  const video = application.introVideo!;
  if (!matchesGuard(application, input) || !["READY_FOR_REVIEW", "APPROVED"].includes(video.status)) throw new AdminReviewConflictError();
  const reviewPlaybackId = await prisma.teacherIntroVideo.findUnique({ where: { id: video.id }, select: { reviewPlaybackId: true } }).then((row) => row?.reviewPlaybackId ?? null);
  const rejectVideo = rejectionIncludesVideo(input.target);
  const reason = input.target === "PROFILE" ? input.profileReason! : input.target === "VIDEO" ? input.videoReason! : `PROFILE: ${input.profileReason}\nVIDEO: ${input.videoReason}`;
  const reconciliationId = await runSerializableAdminTransaction(async (tx) => {
    if (input.target === "PROFILE" && video.status === "READY_FOR_REVIEW") {
      const result = await tx.teacherIntroVideo.updateMany({ where: { id: video.id, revision: video.revision, status: "READY_FOR_REVIEW" }, data: { status: "APPROVED", reviewedAt: new Date(), rejectionReason: null } });
      if (result.count !== 1) throw new AdminReviewConflictError();
    }
    if (rejectVideo) {
      const result = await tx.teacherIntroVideo.updateMany({ where: { id: video.id, revision: video.revision, uploadId: application.submittedVideoUploadId, assetId: application.submittedVideoAssetId, status: { in: ["READY_FOR_REVIEW", "APPROVED"] } }, data: { status: "REJECTED", rejectionReason: input.videoReason, reviewedAt: new Date() } });
      if (result.count !== 1) throw new AdminReviewConflictError();
    }
    const result = await tx.teacherProfile.updateMany({ where: { id: application.id, applicationStatus: "PENDING_REVIEW", reviewCycle: input.reviewCycle, profileRevision: input.profileRevision, submittedProfileRevision: input.profileRevision, submittedVideoId: input.videoId, submittedVideoRevision: input.videoRevision }, data: { applicationStatus: "REJECTED", applicationReviewedAt: new Date(), applicationReviewNote: reason } });
    if (result.count !== 1) throw new AdminReviewConflictError();
    let reconciliationId: string | null = null;
    if (rejectVideo && video.assetId) {
      const reconciliation = await queueMuxPlaybackIntent(tx, { introVideoId: video.id, videoRevision: video.revision, assetId: video.assetId, playbackId: video.publicPlaybackId, desiredState: "REVOKED" });
      reconciliationId = reconciliation.id;
    }
    const snapshot = auditSnapshot(application);
    const events: Prisma.AdminAuditEventCreateManyInput[] = [];
    if (input.target === "PROFILE" && video.status === "READY_FOR_REVIEW") events.push({ actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "VIDEO_APPROVED", reviewCycle: input.reviewCycle, ...snapshot, metadata: { previousVideoStatus: "READY_FOR_REVIEW", newVideoStatus: "APPROVED" } });
    if (rejectionIncludesProfile(input.target)) events.push({ actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "PROFILE_REJECTED", rejectionTarget: "PROFILE", reason: input.profileReason, reviewCycle: input.reviewCycle, ...snapshot, metadata: { reviewedProfileRevision: input.profileRevision } });
    if (rejectVideo) events.push({ actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "VIDEO_REJECTED", rejectionTarget: "VIDEO", reason: input.videoReason, reviewCycle: input.reviewCycle, ...snapshot, metadata: { previousVideoStatus: video.status, newVideoStatus: "REJECTED" } });
    events.push({ actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "APPLICATION_REJECTED", rejectionTarget: input.target, reason, reviewCycle: input.reviewCycle, ...snapshot, metadata: { previousApplicationStatus: "PENDING_REVIEW", newApplicationStatus: "REJECTED", previousVideoStatus: video.status, newVideoStatus: rejectVideo ? "REJECTED" : "APPROVED" } });
    await tx.adminAuditEvent.createMany({ data: events });
    return reconciliationId;
  });
  if (reconciliationId) await reconcileMuxPlayback(reconciliationId);
  if (rejectVideo && video.assetId) await cleanupMuxReviewPlayback({ videoId: video.id, videoRevision: video.revision, assetId: video.assetId, playbackId: reviewPlaybackId });
  return loadAdminTeacherApplication(applicationId);
}

export async function setTeacherSuspension(actorUserId: string, applicationId: string, suspended: boolean, input: { reviewCycle: number; reason: string }) {
  await requireAdminAccess(actorUserId, "MODERATE_TEACHER");
  const expected = suspended ? "APPROVED" : "SUSPENDED";
  const next = suspended ? "SUSPENDED" : "APPROVED";
  const application = await prisma.teacherProfile.findUnique({ where: { id: applicationId }, select: { userId: true, applicationStatus: true, reviewCycle: true, profileRevision: true, user: { select: { accountStatus: true } }, introVideo: { select: { id: true, revision: true, status: true, assetId: true, publicPlaybackId: true } } } });
  if (!application || !application.introVideo) throw new AdminTargetNotFoundError();
  const video = application.introVideo;
  if (application.applicationStatus !== expected || application.reviewCycle !== input.reviewCycle || video.status !== "APPROVED" || !video.assetId || (!suspended && application.user.accountStatus !== "ACTIVE")) throw new AdminReviewConflictError();
  const reconciliationId = await runSerializableAdminTransaction(async (tx) => {
    const result = await tx.teacherProfile.updateMany({ where: { id: applicationId, applicationStatus: expected, reviewCycle: input.reviewCycle, ...(suspended ? {} : { user: { accountStatus: "ACTIVE" } }) }, data: { applicationStatus: next, applicationReviewNote: input.reason, applicationReviewedAt: new Date() } });
    if (result.count !== 1) throw new AdminReviewConflictError();
    const reconciliation = await queueMuxPlaybackIntent(tx, { introVideoId: video.id, videoRevision: video.revision, assetId: video.assetId!, playbackId: video.publicPlaybackId, desiredState: suspended ? "REVOKED" : "ENABLED" });
    await tx.adminAuditEvent.create({ data: { actorUserId, targetUserId: application.userId, teacherProfileId: applicationId, introVideoId: video.id, action: suspended ? "TEACHER_SUSPENDED" : "TEACHER_REINSTATED", reason: input.reason, reviewCycle: input.reviewCycle, profileRevision: application.profileRevision, videoRevision: video.revision, reviewedAssetId: video.assetId, metadata: { previousApplicationStatus: expected, newApplicationStatus: next } } });
    return reconciliation.id;
  });
  await reconcileMuxPlayback(reconciliationId);
  return loadAdminTeacherApplication(applicationId);
}
