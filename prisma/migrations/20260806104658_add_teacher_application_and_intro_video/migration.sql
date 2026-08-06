/*
  Warnings:

  - You are about to drop the column `isVerified` on the
    `teacher_profile` table. Its state is migrated to
    `applicationStatus` before the column is removed.
*/

-- CreateEnum
CREATE TYPE "TeacherApplicationStatus" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED'
);

-- CreateEnum
CREATE TYPE "TeacherIntroVideoStatus" AS ENUM (
  'UPLOAD_PENDING',
  'PROCESSING',
  'READY_FOR_REVIEW',
  'APPROVED',
  'REJECTED',
  'FAILED'
);

-- Add the replacement application fields first.
ALTER TABLE "teacher_profile"
ADD COLUMN "applicationReviewNote" TEXT,
ADD COLUMN "applicationReviewedAt" TIMESTAMP(3),
ADD COLUMN "applicationStatus"
  "TeacherApplicationStatus"
  NOT NULL
  DEFAULT 'DRAFT',
ADD COLUMN "applicationSubmittedAt" TIMESTAMP(3);

-- Preserve previously verified teachers.
UPDATE "teacher_profile"
SET "applicationStatus" =
  'APPROVED'::"TeacherApplicationStatus"
WHERE "isVerified" = true;

-- The old verification field is now safe to remove.
ALTER TABLE "teacher_profile"
DROP COLUMN "isVerified";

-- CreateTable
CREATE TABLE "teacher_intro_video" (
  "id" TEXT NOT NULL,
  "teacherProfileId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'mux',
  "uploadId" TEXT,
  "assetId" TEXT,
  "playbackId" TEXT,
  "status"
    "TeacherIntroVideoStatus"
    NOT NULL
    DEFAULT 'UPLOAD_PENDING',
  "durationSeconds" INTEGER,
  "rejectionReason" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3)
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "teacher_intro_video_pkey"
    PRIMARY KEY ("id")
);

-- One active intro-video record per teacher profile.
CREATE UNIQUE INDEX
  "teacher_intro_video_teacherProfileId_key"
ON "teacher_intro_video"("teacherProfileId");

-- Provider identifiers are unique when present.
CREATE UNIQUE INDEX
  "teacher_intro_video_uploadId_key"
ON "teacher_intro_video"("uploadId");

CREATE UNIQUE INDEX
  "teacher_intro_video_assetId_key"
ON "teacher_intro_video"("assetId");

CREATE UNIQUE INDEX
  "teacher_intro_video_playbackId_key"
ON "teacher_intro_video"("playbackId");

-- Deleting a teacher profile also removes its video metadata.
ALTER TABLE "teacher_intro_video"
ADD CONSTRAINT
  "teacher_intro_video_teacherProfileId_fkey"
FOREIGN KEY ("teacherProfileId")
REFERENCES "teacher_profile"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;