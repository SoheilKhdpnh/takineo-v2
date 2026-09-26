BEGIN;

-- Repair Wave 1 review columns that the applied
-- 20260808120000_add_admin_review_foundation checksum still records as
-- complete on databases whose live teacher_profile never received them.
-- This environment used `submittedProfileVersion` instead of
-- `submittedProfileRevision` and never created mux reconciliation.
-- Statements are idempotent so a fully migrated environment is a no-op.

DO $$
BEGIN
  CREATE TYPE "PlaybackDesiredState" AS ENUM ('ENABLED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "PlaybackReconciliationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teacher_profile'
      AND column_name = 'submittedProfileVersion'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teacher_profile'
      AND column_name = 'submittedProfileRevision'
  ) THEN
    ALTER TABLE "teacher_profile"
      RENAME COLUMN "submittedProfileVersion" TO "submittedProfileRevision";
  END IF;
END
$$;

ALTER TABLE "teacher_profile"
  ADD COLUMN IF NOT EXISTS "legacyApplicationReviewNote" TEXT,
  ADD COLUMN IF NOT EXISTS "legacyApplicationReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "legacyApplicationStatus" "TeacherApplicationStatus",
  ADD COLUMN IF NOT EXISTS "legacyApplicationSubmittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "legacyTrustMigrationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "profileRevision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "submittedProfileRevision" INTEGER,
  ADD COLUMN IF NOT EXISTS "submittedVideoAssetId" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedVideoRevision" INTEGER,
  ADD COLUMN IF NOT EXISTS "submittedVideoUploadId" TEXT;

ALTER TABLE "teacher_intro_video"
  ADD COLUMN IF NOT EXISTS "legacyRejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "legacyReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "legacyStatus" "TeacherIntroVideoStatus",
  ADD COLUMN IF NOT EXISTS "legacySubmittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "legacyTrustMigrationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "admin_audit_event"
  ADD COLUMN IF NOT EXISTS "profileRevision" INTEGER,
  ADD COLUMN IF NOT EXISTS "reviewedAssetId" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedUploadId" TEXT,
  ADD COLUMN IF NOT EXISTS "videoRevision" INTEGER;

UPDATE "teacher_profile"
SET
  "legacyApplicationStatus" = "applicationStatus",
  "legacyApplicationSubmittedAt" = "applicationSubmittedAt",
  "legacyApplicationReviewedAt" = "applicationReviewedAt",
  "legacyApplicationReviewNote" = "applicationReviewNote"
WHERE "legacyApplicationStatus" IS NULL;

UPDATE "teacher_intro_video"
SET
  "legacyStatus" = "status",
  "legacyRejectionReason" = "rejectionReason",
  "legacySubmittedAt" = "submittedAt",
  "legacyReviewedAt" = "reviewedAt"
WHERE "legacyStatus" IS NULL;

DROP INDEX IF EXISTS "teacher_profile_applicationStatus_applicationSubmittedAt_idx";

CREATE INDEX IF NOT EXISTS "teacher_profile_applicationStatus_applicationSubmittedAt_id_idx"
  ON "teacher_profile"("applicationStatus", "applicationSubmittedAt", "id");

CREATE TABLE IF NOT EXISTS "mux_playback_reconciliation" (
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

CREATE INDEX IF NOT EXISTS "mux_playback_reconciliation_status_nextAttemptAt_idx"
  ON "mux_playback_reconciliation"("status", "nextAttemptAt");

CREATE INDEX IF NOT EXISTS "mux_playback_reconciliation_leaseExpiresAt_idx"
  ON "mux_playback_reconciliation"("leaseExpiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "mux_playback_reconciliation_introVideoId_videoRevision_key"
  ON "mux_playback_reconciliation"("introVideoId", "videoRevision");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mux_playback_reconciliation_introVideoId_fkey'
  ) THEN
    ALTER TABLE "mux_playback_reconciliation"
      ADD CONSTRAINT "mux_playback_reconciliation_introVideoId_fkey"
      FOREIGN KEY ("introVideoId")
      REFERENCES "teacher_intro_video"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END
$$;

INSERT INTO "mux_playback_reconciliation" (
  "id",
  "introVideoId",
  "videoRevision",
  "assetId",
  "playbackId",
  "desiredState",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy_' || tiv."id",
  tiv."id",
  tiv."revision",
  tiv."assetId",
  tiv."publicPlaybackId",
  CASE
    WHEN u."accountStatus" = 'ACTIVE'
      AND tp."applicationStatus" = 'APPROVED'
      AND tp."profileCompletedAt" IS NOT NULL
      AND tiv."status" = 'APPROVED'
      THEN 'ENABLED'::"PlaybackDesiredState"
    ELSE 'REVOKED'::"PlaybackDesiredState"
  END,
  'PENDING'::"PlaybackReconciliationStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "teacher_intro_video" tiv
JOIN "teacher_profile" tp ON tp."id" = tiv."teacherProfileId"
JOIN "user" u ON u."id" = tp."userId"
WHERE tiv."publicPlaybackId" IS NOT NULL
  AND tiv."provider" = 'mux'
  AND NULLIF(BTRIM(tiv."uploadId"), '') IS NOT NULL
  AND tiv."uploadId" = BTRIM(tiv."uploadId")
  AND tiv."uploadId" !~ '[[:space:]]'
  AND NULLIF(BTRIM(tiv."assetId"), '') IS NOT NULL
  AND tiv."assetId" = BTRIM(tiv."assetId")
  AND tiv."assetId" !~ '[[:space:]]'
  AND NULLIF(BTRIM(tiv."publicPlaybackId"), '') IS NOT NULL
  AND tiv."publicPlaybackId" = BTRIM(tiv."publicPlaybackId")
  AND tiv."publicPlaybackId" !~ '[[:space:]]'
  AND tiv."uploadId" <> tiv."assetId"
  AND tiv."uploadId" <> tiv."publicPlaybackId"
  AND tiv."assetId" <> tiv."publicPlaybackId"
ON CONFLICT ("introVideoId", "videoRevision") DO NOTHING;

COMMIT;
