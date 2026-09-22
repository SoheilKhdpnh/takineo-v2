import "server-only";

import { requireAdminAccess } from "@/lib/auth/admin-access";
import { prisma } from "@/lib/db/prisma";
import { rejectionIncludesProfile, rejectionIncludesVideo } from "@/lib/domain/admin-review";
import { parseAparatVideoUrl } from "@/lib/domain/aparat-video";
import { AdminReviewConflictError, AdminTargetNotFoundError } from "@/lib/errors/admin-errors";
import { Prisma } from "@/lib/generated/prisma/client";
import { reconcilePublicTeacherDiscoveryEligibility } from "@/lib/services/public-teacher-discovery-eligibility.service";
import { runSerializableAdminTransaction } from "@/lib/services/admin-transaction";

const reviewDetailSelect = {
  id: true, userId: true, headline: true, bio: true, experienceYears: true,
  nativeLanguage: true, teachingLanguage: true, timezone: true, profileCompletedAt: true, profileRevision: true,
  applicationStatus: true, applicationSubmittedAt: true, applicationReviewedAt: true, applicationReviewNote: true,
  reviewCycle: true, submittedProfileRevision: true, submittedVideoId: true, submittedVideoRevision: true,
  submittedAparatHash: true, videoVerificationCode: true, createdAt: true, updatedAt: true,
  user: { select: { id: true, name: true, email: true, accountStatus: true } },
  introVideo: { select: { id: true, provider: true, aparatUrl: true, aparatHash: true, revision: true, status: true, rejectionReason: true, submittedAt: true, reviewedAt: true, createdAt: true, updatedAt: true } },
} satisfies Prisma.TeacherProfileSelect;

type ReviewGuard = { reviewCycle: number; profileRevision: number; videoId: string; videoRevision: number };

export async function listPendingTeacherApplications(actorUserId: string, input: { cursor?: string; limit: number }) {
  await requireAdminAccess(actorUserId);
  const rows = await prisma.teacherProfile.findMany({
    where: { applicationStatus: "PENDING_REVIEW" }, orderBy: [{ applicationSubmittedAt: "asc" }, { id: "asc" }], take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: { id: true, reviewCycle: true, submittedProfileRevision: true, submittedVideoId: true, submittedVideoRevision: true, applicationSubmittedAt: true, user: { select: { name: true, email: true, accountStatus: true } }, introVideo: { select: { id: true, revision: true, status: true } } },
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
  const parsed = video?.aparatUrl ? parseAparatVideoUrl(video.aparatUrl) : null;
  if (application.applicationStatus !== "PENDING_REVIEW" || !video
    || application.reviewCycle < 1 || application.submittedProfileRevision === null
    || application.submittedVideoRevision === null || application.submittedAparatHash === null
    || !application.videoVerificationCode || video.provider !== "aparat" || !video.aparatHash || !parsed
    || application.submittedProfileRevision !== application.profileRevision
    || application.submittedVideoId !== video.id || application.submittedVideoRevision !== video.revision
    || application.submittedAparatHash !== video.aparatHash || parsed.hash !== video.aparatHash) {
    throw new AdminReviewConflictError();
  }
  return application;
}

function matchesGuard(application: Awaited<ReturnType<typeof getPendingReviewTarget>>, input: ReviewGuard) {
  return application.reviewCycle === input.reviewCycle && application.submittedProfileRevision === input.profileRevision
    && application.submittedVideoId === input.videoId && application.submittedVideoRevision === input.videoRevision;
}

function auditSnapshot(application: Awaited<ReturnType<typeof getPendingReviewTarget>>) {
  return { profileRevision: application.submittedProfileRevision!, videoRevision: application.submittedVideoRevision!, reviewedAssetId: application.submittedAparatHash! };
}

export async function approveTeacherApplication(
  actorUserId: string,
  applicationId: string,
  input: ReviewGuard & { spokenCodeConfirmed: true },
) {
  await requireAdminAccess(actorUserId);
  if (input.spokenCodeConfirmed !== true) {
    throw new AdminReviewConflictError();
  }
  const application = await getPendingReviewTarget(applicationId);
  const video = application.introVideo!;
  if (!matchesGuard(application, input) || !["READY_FOR_REVIEW", "APPROVED"].includes(video.status) || !application.profileCompletedAt) {
    throw new AdminReviewConflictError();
  }
  await runSerializableAdminTransaction(async (tx) => {
    const videoUpdate = await tx.teacherIntroVideo.updateMany({
      where: {
        id: video.id,
        revision: input.videoRevision,
        provider: "aparat",
        aparatHash: application.submittedAparatHash,
        status: { in: ["READY_FOR_REVIEW", "APPROVED"] },
      },
      data: { status: "APPROVED", reviewedAt: new Date(), rejectionReason: null },
    });
    const profileUpdate = await tx.teacherProfile.updateMany({
      where: {
        id: application.id,
        applicationStatus: "PENDING_REVIEW",
        reviewCycle: input.reviewCycle,
        profileRevision: input.profileRevision,
        submittedProfileRevision: input.profileRevision,
        submittedVideoId: input.videoId,
        submittedVideoRevision: input.videoRevision,
        submittedAparatHash: application.submittedAparatHash,
        user: { accountStatus: "ACTIVE" },
      },
      data: { applicationStatus: "APPROVED", applicationReviewedAt: new Date(), applicationReviewNote: null },
    });
    if (videoUpdate.count !== 1 || profileUpdate.count !== 1) throw new AdminReviewConflictError();
    await reconcilePublicTeacherDiscoveryEligibility(application.id, tx);
    const snapshot = auditSnapshot(application);
    await tx.adminAuditEvent.createMany({ data: [
      { actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "PROFILE_APPROVED", reviewCycle: input.reviewCycle, ...snapshot, metadata: { reviewedProfileRevision: input.profileRevision } },
      { actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "VIDEO_APPROVED", reviewCycle: input.reviewCycle, ...snapshot, metadata: { previousVideoStatus: video.status, newVideoStatus: "APPROVED", spokenCodeConfirmed: true } },
      { actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "APPLICATION_APPROVED", reviewCycle: input.reviewCycle, ...snapshot, metadata: { previousApplicationStatus: "PENDING_REVIEW", newApplicationStatus: "APPROVED", previousVideoStatus: video.status, newVideoStatus: "APPROVED", spokenCodeConfirmed: true } },
    ] });
  });
  return loadAdminTeacherApplication(applicationId);
}

export async function rejectTeacherApplication(actorUserId: string, applicationId: string, input: ReviewGuard & { target: "PROFILE" | "VIDEO" | "BOTH"; profileReason?: string; videoReason?: string }) {
  await requireAdminAccess(actorUserId);
  const application = await getPendingReviewTarget(applicationId);
  const video = application.introVideo!;
  if (!matchesGuard(application, input) || !["READY_FOR_REVIEW", "APPROVED"].includes(video.status)) throw new AdminReviewConflictError();
  const rejectVideo = rejectionIncludesVideo(input.target);
  const reason = input.target === "PROFILE" ? input.profileReason! : input.target === "VIDEO" ? input.videoReason! : `PROFILE: ${input.profileReason}\nVIDEO: ${input.videoReason}`;
  await runSerializableAdminTransaction(async (tx) => {
    if (input.target === "PROFILE" && video.status === "READY_FOR_REVIEW") {
      const result = await tx.teacherIntroVideo.updateMany({
        where: { id: video.id, revision: video.revision, status: "READY_FOR_REVIEW" },
        data: { status: "APPROVED", reviewedAt: new Date(), rejectionReason: null },
      });
      if (result.count !== 1) throw new AdminReviewConflictError();
    }
    if (rejectVideo) {
      const result = await tx.teacherIntroVideo.updateMany({
        where: {
          id: video.id,
          revision: video.revision,
          provider: "aparat",
          aparatHash: application.submittedAparatHash,
          status: { in: ["READY_FOR_REVIEW", "APPROVED"] },
        },
        data: { status: "REJECTED", rejectionReason: input.videoReason, reviewedAt: new Date() },
      });
      if (result.count !== 1) throw new AdminReviewConflictError();
    }
    const result = await tx.teacherProfile.updateMany({
      where: {
        id: application.id,
        applicationStatus: "PENDING_REVIEW",
        reviewCycle: input.reviewCycle,
        profileRevision: input.profileRevision,
        submittedProfileRevision: input.profileRevision,
        submittedVideoId: input.videoId,
        submittedVideoRevision: input.videoRevision,
      },
      data: { applicationStatus: "REJECTED", applicationReviewedAt: new Date(), applicationReviewNote: reason },
    });
    if (result.count !== 1) throw new AdminReviewConflictError();
    await reconcilePublicTeacherDiscoveryEligibility(application.id, tx);
    const snapshot = auditSnapshot(application);
    const events: Prisma.AdminAuditEventCreateManyInput[] = [];
    if (input.target === "PROFILE" && video.status === "READY_FOR_REVIEW") {
      events.push({ actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "VIDEO_APPROVED", reviewCycle: input.reviewCycle, ...snapshot, metadata: { previousVideoStatus: "READY_FOR_REVIEW", newVideoStatus: "APPROVED" } });
    }
    if (rejectionIncludesProfile(input.target)) {
      events.push({ actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "PROFILE_REJECTED", rejectionTarget: "PROFILE", reason: input.profileReason, reviewCycle: input.reviewCycle, ...snapshot, metadata: { reviewedProfileRevision: input.profileRevision } });
    }
    if (rejectVideo) {
      events.push({ actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "VIDEO_REJECTED", rejectionTarget: "VIDEO", reason: input.videoReason, reviewCycle: input.reviewCycle, ...snapshot, metadata: { previousVideoStatus: video.status, newVideoStatus: "REJECTED" } });
    }
    events.push({ actorUserId, targetUserId: application.userId, teacherProfileId: application.id, introVideoId: video.id, action: "APPLICATION_REJECTED", rejectionTarget: input.target, reason, reviewCycle: input.reviewCycle, ...snapshot, metadata: { previousApplicationStatus: "PENDING_REVIEW", newApplicationStatus: "REJECTED", previousVideoStatus: video.status, newVideoStatus: rejectVideo ? "REJECTED" : "APPROVED" } });
    await tx.adminAuditEvent.createMany({ data: events });
  });
  return loadAdminTeacherApplication(applicationId);
}

export async function setTeacherSuspension(actorUserId: string, applicationId: string, suspended: boolean, input: { reviewCycle: number; reason: string }) {
  await requireAdminAccess(actorUserId, "MODERATE_TEACHER");
  const expected = suspended ? "APPROVED" : "SUSPENDED";
  const next = suspended ? "SUSPENDED" : "APPROVED";
  const application = await prisma.teacherProfile.findUnique({
    where: { id: applicationId },
    select: {
      userId: true,
      applicationStatus: true,
      reviewCycle: true,
      profileRevision: true,
      user: { select: { accountStatus: true } },
      introVideo: { select: { id: true, revision: true, status: true, aparatHash: true } },
    },
  });
  if (!application || !application.introVideo) throw new AdminTargetNotFoundError();
  const video = application.introVideo;
  if (application.applicationStatus !== expected || application.reviewCycle !== input.reviewCycle || video.status !== "APPROVED" || (!suspended && application.user.accountStatus !== "ACTIVE")) {
    throw new AdminReviewConflictError();
  }
  await runSerializableAdminTransaction(async (tx) => {
    const result = await tx.teacherProfile.updateMany({
      where: { id: applicationId, applicationStatus: expected, reviewCycle: input.reviewCycle, ...(suspended ? {} : { user: { accountStatus: "ACTIVE" } }) },
      data: { applicationStatus: next, applicationReviewNote: input.reason, applicationReviewedAt: new Date() },
    });
    if (result.count !== 1) throw new AdminReviewConflictError();
    await reconcilePublicTeacherDiscoveryEligibility(applicationId, tx);
    await tx.adminAuditEvent.create({
      data: {
        actorUserId,
        targetUserId: application.userId,
        teacherProfileId: applicationId,
        introVideoId: video.id,
        action: suspended ? "TEACHER_SUSPENDED" : "TEACHER_REINSTATED",
        reason: input.reason,
        reviewCycle: input.reviewCycle,
        profileRevision: application.profileRevision,
        videoRevision: video.revision,
        reviewedAssetId: video.aparatHash,
        metadata: { previousApplicationStatus: expected, newApplicationStatus: next },
      },
    });
  });
  return loadAdminTeacherApplication(applicationId);
}

