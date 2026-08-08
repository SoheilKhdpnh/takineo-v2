import "server-only";

import { requireAdminAccess } from "@/lib/auth/admin-access";
import { prisma } from "@/lib/db/prisma";
import { ADMIN_REVIEW_PLAYBACK_TTL_SECONDS, rejectionIncludesProfile, rejectionIncludesVideo } from "@/lib/domain/admin-review";
import { AdminReviewConflictError, AdminReviewProviderError, AdminTargetNotFoundError } from "@/lib/errors/admin-errors";
import { Prisma } from "@/lib/generated/prisma/client";
import { getMuxClient } from "@/lib/video/mux-client";
import { getMuxSigningConfiguration } from "@/lib/video/mux-config";

const reviewDetailSelect = {
  id: true, userId: true, headline: true, bio: true, experienceYears: true,
  nativeLanguage: true, teachingLanguage: true, timezone: true, profileCompletedAt: true,
  applicationStatus: true, applicationSubmittedAt: true, applicationReviewedAt: true,
  applicationReviewNote: true, reviewCycle: true, submittedProfileVersion: true,
  submittedVideoId: true, updatedAt: true,
  user: { select: { id: true, name: true, email: true, accountStatus: true } },
  introVideo: { select: { id: true, assetId: true, status: true, durationSeconds: true, rejectionReason: true, submittedAt: true, reviewedAt: true, updatedAt: true } },
} satisfies Prisma.TeacherProfileSelect;

export async function listPendingTeacherApplications(actorUserId: string, input: { cursor?: string; limit: number }) {
  await requireAdminAccess(actorUserId);
  const rows = await prisma.teacherProfile.findMany({
    where: { applicationStatus: "PENDING_REVIEW" },
    orderBy: [{ applicationSubmittedAt: "asc" }, { id: "asc" }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: { id: true, reviewCycle: true, applicationSubmittedAt: true, submittedVideoId: true, user: { select: { name: true, email: true, accountStatus: true } }, introVideo: { select: { id: true, status: true, durationSeconds: true } } },
  });
  const hasMore = rows.length > input.limit;
  const applications = hasMore ? rows.slice(0, input.limit) : rows;
  return { applications, nextCursor: hasMore ? applications.at(-1)?.id ?? null : null };
}

export async function getAdminTeacherApplication(actorUserId: string, applicationId: string) {
  await requireAdminAccess(actorUserId);
  const application = await prisma.teacherProfile.findUnique({ where: { id: applicationId }, select: reviewDetailSelect });
  if (!application) throw new AdminTargetNotFoundError();
  return application;
}

async function getPendingReviewTarget(applicationId: string) {
  const application = await prisma.teacherProfile.findUnique({ where: { id: applicationId }, select: reviewDetailSelect });
  if (!application) throw new AdminTargetNotFoundError();
  if (application.applicationStatus !== "PENDING_REVIEW" || !application.introVideo || application.submittedVideoId !== application.introVideo.id) throw new AdminReviewConflictError();
  return application;
}

export async function createAdminReviewPlayback(actorUserId: string, applicationId: string) {
  await requireAdminAccess(actorUserId);
  const application = await getPendingReviewTarget(applicationId);
  const video = application.introVideo!;
  if (!video.assetId || (video.status !== "READY_FOR_REVIEW" && video.status !== "APPROVED")) throw new AdminReviewConflictError();
  try {
    const mux = getMuxClient();
    let playbackId = await prisma.teacherIntroVideo.findUnique({ where: { id: video.id }, select: { reviewPlaybackId: true } }).then((row) => row?.reviewPlaybackId ?? null);
    if (!playbackId) {
      const created = await mux.video.assets.createPlaybackId(video.assetId, { policy: "signed" });
      playbackId = created.id;
      const saved = await prisma.teacherIntroVideo.updateMany({ where: { id: video.id, assetId: video.assetId, reviewPlaybackId: null }, data: { reviewPlaybackId: playbackId } });
      if (saved.count !== 1) {
        await mux.video.assets.deletePlaybackId(video.assetId, playbackId).catch(() => undefined);
        const current = await prisma.teacherIntroVideo.findUnique({ where: { id: video.id }, select: { reviewPlaybackId: true } });
        playbackId = current?.reviewPlaybackId ?? null;
      }
    }
    if (!playbackId) throw new AdminReviewProviderError();
    const signing = getMuxSigningConfiguration();
    const token = await mux.jwt.signPlaybackId(playbackId, { type: "video", expiration: `${ADMIN_REVIEW_PLAYBACK_TTL_SECONDS}s`, keyId: signing.keyId, keySecret: signing.privateKey });
    return { playbackId, token, expiresInSeconds: ADMIN_REVIEW_PLAYBACK_TTL_SECONDS };
  } catch (error) {
    if (error instanceof AdminReviewProviderError) throw error;
    throw new AdminReviewProviderError();
  }
}

export async function approveTeacherApplication(actorUserId: string, applicationId: string, input: { reviewCycle: number; videoId: string }) {
  await requireAdminAccess(actorUserId);
  const application = await getPendingReviewTarget(applicationId);
  const video = application.introVideo!;
  if (application.reviewCycle !== input.reviewCycle || video.id !== input.videoId || video.status !== "READY_FOR_REVIEW" || !video.assetId || !application.profileCompletedAt || application.submittedProfileVersion?.getTime() !== application.updatedAt.getTime()) throw new AdminReviewConflictError();

  let publicPlaybackId: string;
  try { publicPlaybackId = (await getMuxClient().video.assets.createPlaybackId(video.assetId, { policy: "public" })).id; }
  catch { throw new AdminReviewProviderError(); }

  try {
    return await prisma.$transaction(async (tx) => {
      const videoUpdate = await tx.teacherIntroVideo.updateMany({ where: { id: video.id, status: "READY_FOR_REVIEW", assetId: video.assetId, publicPlaybackId: null }, data: { status: "APPROVED", reviewedAt: new Date(), rejectionReason: null, publicPlaybackId } });
      const profileUpdate = await tx.teacherProfile.updateMany({ where: { id: application.id, applicationStatus: "PENDING_REVIEW", reviewCycle: input.reviewCycle, submittedVideoId: video.id, updatedAt: application.updatedAt }, data: { applicationStatus: "APPROVED", applicationReviewedAt: new Date(), applicationReviewNote: null } });
      if (videoUpdate.count !== 1 || profileUpdate.count !== 1) throw new AdminReviewConflictError();
      await tx.adminAuditEvent.createMany({ data: [
        { actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "PROFILE_APPROVED", reviewCycle: input.reviewCycle },
        { actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "VIDEO_APPROVED", reviewCycle: input.reviewCycle },
        { actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "APPLICATION_APPROVED", reviewCycle: input.reviewCycle, metadata: { previousApplicationStatus: "PENDING_REVIEW", newApplicationStatus: "APPROVED" } },
      ] });
      return tx.teacherProfile.findUniqueOrThrow({ where: { id: application.id }, select: reviewDetailSelect });
    });
  } catch (error) {
    await getMuxClient().video.assets.deletePlaybackId(video.assetId, publicPlaybackId).catch(() => undefined);
    if (error instanceof AdminReviewConflictError) throw error;
    throw error;
  }
}

export async function rejectTeacherApplication(actorUserId: string, applicationId: string, input: { reviewCycle: number; videoId: string; target: "PROFILE" | "VIDEO" | "BOTH"; profileReason?: string; videoReason?: string }) {
  await requireAdminAccess(actorUserId);
  const application = await getPendingReviewTarget(applicationId);
  const video = application.introVideo!;
  if (application.reviewCycle !== input.reviewCycle || video.id !== input.videoId) throw new AdminReviewConflictError();
  const rejectVideo = rejectionIncludesVideo(input.target);
  const reason = input.target === "PROFILE" ? input.profileReason! : input.target === "VIDEO" ? input.videoReason! : `PROFILE: ${input.profileReason}\nVIDEO: ${input.videoReason}`;

  return prisma.$transaction(async (tx) => {
    if (input.target === "PROFILE" && video.status === "READY_FOR_REVIEW") {
      const videoApproval = await tx.teacherIntroVideo.updateMany({ where: { id: video.id, status: "READY_FOR_REVIEW" }, data: { status: "APPROVED", reviewedAt: new Date(), rejectionReason: null } });
      if (videoApproval.count !== 1) throw new AdminReviewConflictError();
    }
    if (rejectVideo) {
      const result = await tx.teacherIntroVideo.updateMany({ where: { id: video.id, status: { in: ["READY_FOR_REVIEW", "APPROVED"] } }, data: { status: "REJECTED", rejectionReason: input.videoReason, reviewedAt: new Date(), publicPlaybackId: null } });
      if (result.count !== 1) throw new AdminReviewConflictError();
    }
    const result = await tx.teacherProfile.updateMany({ where: { id: application.id, applicationStatus: "PENDING_REVIEW", reviewCycle: input.reviewCycle, submittedVideoId: video.id }, data: { applicationStatus: "REJECTED", applicationReviewedAt: new Date(), applicationReviewNote: reason } });
    if (result.count !== 1) throw new AdminReviewConflictError();
    const events: Prisma.AdminAuditEventCreateManyInput[] = [];
    if (input.target === "PROFILE" && video.status === "READY_FOR_REVIEW") events.push({ actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "VIDEO_APPROVED", reviewCycle: input.reviewCycle });
    if (rejectionIncludesProfile(input.target)) events.push({ actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "PROFILE_REJECTED", rejectionTarget: "PROFILE", reason: input.profileReason, reviewCycle: input.reviewCycle });
    if (rejectVideo) events.push({ actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "VIDEO_REJECTED", rejectionTarget: "VIDEO", reason: input.videoReason, reviewCycle: input.reviewCycle });
    events.push({ actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "APPLICATION_REJECTED", rejectionTarget: input.target, reason, reviewCycle: input.reviewCycle, metadata: { previousApplicationStatus: "PENDING_REVIEW", newApplicationStatus: "REJECTED" } });
    await tx.adminAuditEvent.createMany({ data: events });
    return tx.teacherProfile.findUniqueOrThrow({ where: { id: application.id }, select: reviewDetailSelect });
  });
}

export async function setTeacherSuspension(actorUserId: string, applicationId: string, suspended: boolean, input: { reviewCycle: number; reason: string }) {
  await requireAdminAccess(actorUserId, "MODERATE_TEACHER");
  const expected = suspended ? "APPROVED" : "SUSPENDED";
  const next = suspended ? "SUSPENDED" : "APPROVED";
  const application = await prisma.teacherProfile.findUnique({ where: { id: applicationId }, select: { userId: true, applicationStatus: true, reviewCycle: true, introVideo: { select: { id: true, status: true, assetId: true, publicPlaybackId: true } } } });
  if (!application) throw new AdminTargetNotFoundError();
  if (application.applicationStatus !== expected || application.reviewCycle !== input.reviewCycle || !application.introVideo || application.introVideo.status !== "APPROVED" || !application.introVideo.assetId) throw new AdminReviewConflictError();
  const video = application.introVideo;
  const assetId = video.assetId as string;
  let nextPublicPlaybackId: string | null = null;
  try {
    if (suspended && video.publicPlaybackId) await getMuxClient().video.assets.deletePlaybackId(assetId, video.publicPlaybackId);
    if (!suspended) nextPublicPlaybackId = (await getMuxClient().video.assets.createPlaybackId(assetId, { policy: "public" })).id;
  } catch { throw new AdminReviewProviderError(); }
  try {
    return await prisma.$transaction(async (tx) => {
    const result = await tx.teacherProfile.updateMany({ where: { id: applicationId, applicationStatus: expected, reviewCycle: input.reviewCycle }, data: { applicationStatus: next, applicationReviewNote: input.reason, applicationReviewedAt: new Date() } });
    if (result.count !== 1) throw new AdminReviewConflictError();
    const videoResult = await tx.teacherIntroVideo.updateMany({ where: { id: video.id, assetId, publicPlaybackId: suspended ? video.publicPlaybackId : null }, data: { publicPlaybackId: nextPublicPlaybackId } });
    if (videoResult.count !== 1) throw new AdminReviewConflictError();
    await tx.adminAuditEvent.create({ data: { actorUserId, targetUserId: application.userId, teacherProfileId: applicationId, introVideoId: video.id, action: suspended ? "TEACHER_SUSPENDED" : "TEACHER_REINSTATED", reason: input.reason, reviewCycle: input.reviewCycle, metadata: { previousApplicationStatus: expected, newApplicationStatus: next } } });
    return tx.teacherProfile.findUniqueOrThrow({ where: { id: applicationId }, select: reviewDetailSelect });
    });
  } catch (error) {
    if (nextPublicPlaybackId) await getMuxClient().video.assets.deletePlaybackId(assetId, nextPublicPlaybackId).catch(() => undefined);
    throw error;
  }
}
