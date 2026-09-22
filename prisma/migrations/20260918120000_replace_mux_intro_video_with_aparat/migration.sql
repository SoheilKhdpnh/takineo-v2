-- Replace Mux intro-video storage with Aparat URL submission.
-- Mux Terms §13.7 requires OFAC compliance and a warranty that the customer
-- is not located in, under the control of, or a national/resident of any
-- restricted/embargoed country. Talkinu's launch market is Iran, so Mux is
-- not an eligible production provider. See docs/engineering/vendor-eligibility.md.

BEGIN;

ALTER TABLE "teacher_profile"
  ADD COLUMN IF NOT EXISTS "videoVerificationCode" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedAparatHash" TEXT;

UPDATE "teacher_profile"
SET "videoVerificationCode" = upper(substr(md5(random()::text || "id"), 1, 5))
WHERE "videoVerificationCode" IS NULL;

ALTER TABLE "teacher_intro_video"
  ADD COLUMN IF NOT EXISTS "aparatUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "aparatHash" TEXT;

ALTER TABLE "teacher_intro_video"
  ALTER COLUMN "provider" SET DEFAULT 'aparat';

-- Existing Mux rows cannot be replayed on Aparat. Force replacement.
UPDATE "teacher_intro_video"
SET
  "status" = 'REJECTED',
  "rejectionReason" = COALESCE(
    NULLIF(BTRIM("rejectionReason"), ''),
    'MUX_PROVIDER_RETIRED'
  ),
  "provider" = 'aparat'
WHERE "aparatHash" IS NULL
  AND "provider" = 'mux';

-- Drop Mux reconciliation before video columns it depends on.
ALTER TABLE "mux_playback_reconciliation"
  DROP CONSTRAINT IF EXISTS "mux_playback_reconciliation_introVideoId_fkey";

DROP TABLE IF EXISTS "mux_playback_reconciliation";

DROP INDEX IF EXISTS "teacher_intro_video_uploadId_key";
DROP INDEX IF EXISTS "teacher_intro_video_assetId_key";
DROP INDEX IF EXISTS "teacher_intro_video_reviewPlaybackId_key";
DROP INDEX IF EXISTS "teacher_intro_video_publicPlaybackId_key";

ALTER TABLE "teacher_intro_video"
  DROP COLUMN IF EXISTS "uploadId",
  DROP COLUMN IF EXISTS "assetId",
  DROP COLUMN IF EXISTS "reviewPlaybackId",
  DROP COLUMN IF EXISTS "publicPlaybackId",
  DROP COLUMN IF EXISTS "durationSeconds";

ALTER TABLE "teacher_profile"
  DROP COLUMN IF EXISTS "submittedVideoUploadId",
  DROP COLUMN IF EXISTS "submittedVideoAssetId";

DROP TYPE IF EXISTS "PlaybackDesiredState";
DROP TYPE IF EXISTS "PlaybackReconciliationStatus";

COMMIT;
