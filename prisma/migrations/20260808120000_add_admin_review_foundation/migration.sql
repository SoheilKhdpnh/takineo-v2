-- Administrative permissions are deliberately separate from product roles.
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');
CREATE TYPE "AdminPermission" AS ENUM ('REVIEWER', 'SUPER_ADMIN');
CREATE TYPE "AdminAuditAction" AS ENUM ('ADMIN_BOOTSTRAPPED', 'ADMIN_ACCESS_GRANTED', 'ADMIN_ACCESS_REVOKED', 'ADMIN_PERMISSION_CHANGED', 'PROFILE_APPROVED', 'PROFILE_REJECTED', 'VIDEO_APPROVED', 'VIDEO_REJECTED', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED', 'TEACHER_SUSPENDED', 'TEACHER_REINSTATED', 'ACCOUNT_STATUS_CHANGED');
CREATE TYPE "ReviewRejectionTarget" AS ENUM ('PROFILE', 'VIDEO', 'BOTH');

ALTER TABLE "user" ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "teacher_profile"
  ADD COLUMN "reviewCycle" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "submittedProfileVersion" TIMESTAMP(3),
  ADD COLUMN "submittedVideoId" TEXT;

-- The legacy field represented the only/public playback ID. Preserve it under
-- its now-explicit public lifecycle name before adding private review playback.
ALTER TABLE "teacher_intro_video" RENAME COLUMN "playbackId" TO "publicPlaybackId";
ALTER INDEX "teacher_intro_video_playbackId_key" RENAME TO "teacher_intro_video_publicPlaybackId_key";
ALTER TABLE "teacher_intro_video" ADD COLUMN "reviewPlaybackId" TEXT;
CREATE UNIQUE INDEX "teacher_intro_video_reviewPlaybackId_key" ON "teacher_intro_video"("reviewPlaybackId");

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
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_access_userId_key" ON "admin_access"("userId");
CREATE INDEX "admin_access_permission_revokedAt_idx" ON "admin_access"("permission", "revokedAt");
CREATE INDEX "teacher_profile_applicationStatus_applicationSubmittedAt_idx" ON "teacher_profile"("applicationStatus", "applicationSubmittedAt");
CREATE INDEX "admin_audit_event_teacherProfileId_createdAt_idx" ON "admin_audit_event"("teacherProfileId", "createdAt");
CREATE INDEX "admin_audit_event_actorUserId_createdAt_idx" ON "admin_audit_event"("actorUserId", "createdAt");
CREATE INDEX "admin_audit_event_action_createdAt_idx" ON "admin_audit_event"("action", "createdAt");

ALTER TABLE "admin_access" ADD CONSTRAINT "admin_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_audit_event" ADD CONSTRAINT "admin_audit_event_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_audit_event" ADD CONSTRAINT "admin_audit_event_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_audit_event" ADD CONSTRAINT "admin_audit_event_introVideoId_fkey" FOREIGN KEY ("introVideoId") REFERENCES "teacher_intro_video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Audit rows are append-only, including for database clients that bypass the app.
CREATE FUNCTION prevent_admin_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_event is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_audit_event_immutable
BEFORE UPDATE OR DELETE ON "admin_audit_event"
FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_mutation();
