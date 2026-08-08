BEGIN;

-- Administrative permissions are deliberately separate from product roles.
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');
CREATE TYPE "AdminPermission" AS ENUM ('REVIEWER', 'SUPER_ADMIN');
CREATE TYPE "AdminAuditAction" AS ENUM ('ADMIN_BOOTSTRAPPED', 'ADMIN_ACCESS_GRANTED', 'ADMIN_ACCESS_REVOKED', 'ADMIN_PERMISSION_CHANGED', 'PROFILE_APPROVED', 'PROFILE_REJECTED', 'VIDEO_APPROVED', 'VIDEO_REJECTED', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED', 'TEACHER_SUSPENDED', 'TEACHER_REINSTATED', 'ACCOUNT_STATUS_CHANGED');
CREATE TYPE "ReviewRejectionTarget" AS ENUM ('PROFILE', 'VIDEO', 'BOTH');
CREATE TYPE "PlaybackDesiredState" AS ENUM ('ENABLED', 'REVOKED');
CREATE TYPE "PlaybackReconciliationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

ALTER TABLE "user" ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "teacher_profile"
  ADD COLUMN "reviewCycle" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "profileRevision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "submittedProfileRevision" INTEGER,
  ADD COLUMN "submittedVideoId" TEXT,
  ADD COLUMN "submittedVideoRevision" INTEGER,
  ADD COLUMN "submittedVideoUploadId" TEXT,
  ADD COLUMN "submittedVideoAssetId" TEXT,
  ADD COLUMN "legacyApplicationStatus" "TeacherApplicationStatus",
  ADD COLUMN "legacyApplicationReviewedAt" TIMESTAMP(3),
  ADD COLUMN "legacyApplicationReviewNote" TEXT,
  ADD COLUMN "legacyTrustMigrationReason" TEXT;

-- The legacy field represented the only/public playback ID. Preserve it under
-- its now-explicit public lifecycle name before adding private review playback.
ALTER TABLE "teacher_intro_video" RENAME COLUMN "playbackId" TO "publicPlaybackId";
ALTER INDEX "teacher_intro_video_playbackId_key" RENAME TO "teacher_intro_video_publicPlaybackId_key";
ALTER TABLE "teacher_intro_video" ADD COLUMN "reviewPlaybackId" TEXT;
ALTER TABLE "teacher_intro_video" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "teacher_intro_video"
  ADD COLUMN "legacyStatus" "TeacherIntroVideoStatus",
  ADD COLUMN "legacyRejectionReason" TEXT,
  ADD COLUMN "legacyTrustMigrationReason" TEXT;
CREATE UNIQUE INDEX "teacher_intro_video_reviewPlaybackId_key" ON "teacher_intro_video"("reviewPlaybackId");

-- Preserve only pending reviews with coherent evidence for the submitted media.
UPDATE "teacher_profile" AS tp
SET "reviewCycle" = 1,
    "submittedProfileRevision" = tp."profileRevision",
    "submittedVideoId" = tiv."id",
    "submittedVideoRevision" = tiv."revision",
    "submittedVideoUploadId" = tiv."uploadId",
    "submittedVideoAssetId" = tiv."assetId"
FROM "teacher_intro_video" AS tiv
WHERE tp."applicationStatus" = 'PENDING_REVIEW'
  AND tiv."teacherProfileId" = tp."id"
  AND tp."profileCompletedAt" IS NOT NULL
  AND tiv."provider" = 'mux'
  AND tiv."status" IN ('READY_FOR_REVIEW', 'APPROVED')
  AND NULLIF(BTRIM(tiv."uploadId"), '') IS NOT NULL
  AND NULLIF(BTRIM(tiv."assetId"), '') IS NOT NULL
  AND tiv."uploadId" <> tiv."assetId"
  AND tiv."durationSeconds" BETWEEN 60 AND 120;

-- Preserve sufficient APPROVED/SUSPENDED legacy states, but snapshot their
-- current evidence for future investigation and review-cycle semantics.
UPDATE "teacher_profile" AS tp
SET "reviewCycle" = GREATEST(tp."reviewCycle", 1),
    "submittedProfileRevision" = tp."profileRevision",
    "submittedVideoId" = tiv."id",
    "submittedVideoRevision" = tiv."revision",
    "submittedVideoUploadId" = tiv."uploadId",
    "submittedVideoAssetId" = tiv."assetId"
FROM "teacher_intro_video" AS tiv
WHERE tp."applicationStatus" IN ('APPROVED', 'SUSPENDED')
  AND tiv."teacherProfileId" = tp."id"
  AND tp."profileCompletedAt" IS NOT NULL
  AND tiv."provider" = 'mux'
  AND tiv."status" = 'APPROVED'
  AND NULLIF(BTRIM(tiv."uploadId"), '') IS NOT NULL
  AND NULLIF(BTRIM(tiv."assetId"), '') IS NOT NULL
  AND tiv."uploadId" <> tiv."assetId"
  AND tiv."durationSeconds" BETWEEN 60 AND 120;

-- Snapshot and reject unusable legacy video evidence before changing its
-- current state. Valid approved media is preserved when only profile evidence
-- is insufficient, allowing correction without unnecessary replacement.
UPDATE "teacher_intro_video" AS tiv
SET "legacyStatus" = tiv."status",
    "legacyRejectionReason" = tiv."rejectionReason",
    "legacyTrustMigrationReason" = 'LEGACY_VIDEO_EVIDENCE_INSUFFICIENT',
    "status" = 'REJECTED',
    "rejectionReason" = COALESCE(tiv."rejectionReason", 'LEGACY_VIDEO_REQUIRES_REPLACEMENT'),
    "reviewedAt" = COALESCE(tiv."reviewedAt", CURRENT_TIMESTAMP)
FROM "teacher_profile" AS tp
WHERE tiv."teacherProfileId" = tp."id"
  AND tp."applicationStatus" IN ('PENDING_REVIEW', 'APPROVED', 'SUSPENDED')
  AND NOT COALESCE((
    tiv."provider" = 'mux'
    AND tiv."status" IN ('READY_FOR_REVIEW', 'APPROVED')
    AND NULLIF(BTRIM(tiv."uploadId"), '') IS NOT NULL
    AND NULLIF(BTRIM(tiv."assetId"), '') IS NOT NULL
    AND tiv."uploadId" <> tiv."assetId"
    AND tiv."durationSeconds" BETWEEN 60 AND 120
  ), false);

-- Malformed pending rows become editable/recoverable without overwriting their
-- historical note or timestamp.
UPDATE "teacher_profile"
SET "applicationStatus" = 'REJECTED',
    "legacyApplicationStatus" = 'PENDING_REVIEW',
    "legacyApplicationReviewedAt" = "applicationReviewedAt",
    "legacyApplicationReviewNote" = "applicationReviewNote",
    "legacyTrustMigrationReason" = 'LEGACY_REVIEW_STATE_REQUIRES_RESUBMISSION'
WHERE "applicationStatus" = 'PENDING_REVIEW'
  AND ("reviewCycle" = 0
    OR "submittedProfileRevision" IS NULL
    OR "submittedVideoId" IS NULL
    OR "submittedVideoRevision" IS NULL
    OR "submittedVideoUploadId" IS NULL
    OR "submittedVideoAssetId" IS NULL);

-- An old isVerified-derived state is not sufficient. Downgrade legacy
-- APPROVED/SUSPENDED rows unless the complete new evidence snapshot exists.
UPDATE "teacher_profile"
SET "legacyApplicationStatus" = "applicationStatus",
    "legacyApplicationReviewedAt" = "applicationReviewedAt",
    "legacyApplicationReviewNote" = "applicationReviewNote",
    "legacyTrustMigrationReason" = 'LEGACY_TRUST_EVIDENCE_INSUFFICIENT',
    "applicationStatus" = 'REJECTED'
WHERE "applicationStatus" IN ('APPROVED', 'SUSPENDED')
  AND ("submittedProfileRevision" IS NULL
    OR "submittedVideoId" IS NULL
    OR "submittedVideoRevision" IS NULL
    OR "submittedVideoUploadId" IS NULL
    OR "submittedVideoAssetId" IS NULL);

CREATE TABLE "admin_access" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permission" "AdminPermission" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "admin_access_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_audit_event" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "targetUserId" TEXT,
  "teacherProfileId" TEXT,
  "introVideoId" TEXT,
  "action" "AdminAuditAction" NOT NULL,
  "rejectionTarget" "ReviewRejectionTarget",
  "reason" TEXT,
  "reviewCycle" INTEGER,
  "profileRevision" INTEGER,
  "videoRevision" INTEGER,
  "reviewedUploadId" TEXT,
  "reviewedAssetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mux_playback_reconciliation" (
  "id" TEXT NOT NULL,
  "introVideoId" TEXT NOT NULL,
  "videoRevision" INTEGER NOT NULL,
  "assetId" TEXT NOT NULL,
  "playbackId" TEXT,
  "desiredState" "PlaybackDesiredState" NOT NULL,
  "intentGeneration" INTEGER NOT NULL DEFAULT 1,
  "status" "PlaybackReconciliationStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastAttemptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mux_playback_reconciliation_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "teacher_intro_video"
    WHERE "publicPlaybackId" IS NOT NULL AND "assetId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot migrate public playback without its Mux asset identity';
  END IF;
END;
$$;

-- Preserve every legacy public playback reference in durable reconciliation.
-- Ineligible rows converge to revocation; eligible rows enter verification and
-- convergence without assuming that the stored identifier reflects provider truth.
INSERT INTO "mux_playback_reconciliation" (
  "id", "introVideoId", "videoRevision", "assetId", "playbackId",
  "desiredState", "status", "createdAt", "updatedAt"
)
SELECT
  'legacy_' || tiv."id", tiv."id", tiv."revision", tiv."assetId",
  tiv."publicPlaybackId",
  CASE WHEN u."accountStatus" = 'ACTIVE'
         AND tp."applicationStatus" = 'APPROVED'
         AND tp."profileCompletedAt" IS NOT NULL
         AND tiv."status" = 'APPROVED'
       THEN 'ENABLED'::"PlaybackDesiredState"
       ELSE 'REVOKED'::"PlaybackDesiredState" END,
  'PENDING'::"PlaybackReconciliationStatus",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "teacher_intro_video" tiv
JOIN "teacher_profile" tp ON tp."id" = tiv."teacherProfileId"
JOIN "user" u ON u."id" = tp."userId"
WHERE tiv."publicPlaybackId" IS NOT NULL
  AND tiv."assetId" IS NOT NULL;

CREATE UNIQUE INDEX "admin_access_userId_key" ON "admin_access"("userId");
CREATE INDEX "admin_access_permission_revokedAt_idx" ON "admin_access"("permission", "revokedAt");
CREATE INDEX "teacher_profile_applicationStatus_applicationSubmittedAt_id_idx" ON "teacher_profile"("applicationStatus", "applicationSubmittedAt", "id");
CREATE INDEX "admin_audit_event_teacherProfileId_createdAt_idx" ON "admin_audit_event"("teacherProfileId", "createdAt");
CREATE INDEX "admin_audit_event_actorUserId_createdAt_idx" ON "admin_audit_event"("actorUserId", "createdAt");
CREATE INDEX "admin_audit_event_action_createdAt_idx" ON "admin_audit_event"("action", "createdAt");
CREATE UNIQUE INDEX "mux_playback_reconciliation_introVideoId_videoRevision_key" ON "mux_playback_reconciliation"("introVideoId", "videoRevision");
CREATE INDEX "mux_playback_reconciliation_status_nextAttemptAt_idx" ON "mux_playback_reconciliation"("status", "nextAttemptAt");
CREATE INDEX "mux_playback_reconciliation_leaseExpiresAt_idx" ON "mux_playback_reconciliation"("leaseExpiresAt");

ALTER TABLE "admin_access" ADD CONSTRAINT "admin_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_audit_event" ADD CONSTRAINT "admin_audit_event_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_audit_event" ADD CONSTRAINT "admin_audit_event_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_audit_event" ADD CONSTRAINT "admin_audit_event_introVideoId_fkey" FOREIGN KEY ("introVideoId") REFERENCES "teacher_intro_video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mux_playback_reconciliation" ADD CONSTRAINT "mux_playback_reconciliation_introVideoId_fkey" FOREIGN KEY ("introVideoId") REFERENCES "teacher_intro_video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Audit rows are append-only, including for database clients that bypass the app.
CREATE FUNCTION prevent_admin_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_event is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_audit_event_immutable
BEFORE UPDATE OR DELETE ON "admin_audit_event"
FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_mutation();

CREATE TRIGGER admin_audit_event_no_truncate
BEFORE TRUNCATE ON "admin_audit_event"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_admin_audit_mutation();

COMMIT;
