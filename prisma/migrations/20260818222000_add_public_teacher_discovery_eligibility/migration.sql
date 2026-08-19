BEGIN;

-- Durable membership projection for public teacher discovery.
--
-- This table contains no moderation, application-review, account,
-- media-provider, or other private metadata. Membership means only
-- that the teacher satisfied the canonical public-teacher policy at
-- the source mutation transaction that last affected eligibility.
CREATE TABLE "public_teacher_discovery_eligibility" (
  "teacherProfileId" TEXT NOT NULL,

  CONSTRAINT "public_teacher_discovery_eligibility_pkey"
    PRIMARY KEY ("teacherProfileId")
);

ALTER TABLE
  "public_teacher_discovery_eligibility"
ADD CONSTRAINT
  "public_teacher_discovery_eligibility_teacherProfileId_fkey"
FOREIGN KEY (
  "teacherProfileId"
)
REFERENCES
  "teacher_profile"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- One-time set-based backfill.
--
-- Runtime code does not independently redefine this predicate:
-- ongoing membership reconciliation calls the canonical
-- isPublicTeacher() domain policy.
INSERT INTO
  "public_teacher_discovery_eligibility" (
    "teacherProfileId"
  )
SELECT
  tp."id"
FROM
  "teacher_profile" AS tp
INNER JOIN
  "user" AS u
ON
  u."id" = tp."userId"
INNER JOIN
  "teacher_intro_video" AS tiv
ON
  tiv."teacherProfileId" = tp."id"
WHERE
  u."accountStatus" = 'ACTIVE'
  AND tp."applicationStatus" = 'APPROVED'
  AND tp."profileCompletedAt" IS NOT NULL
  AND tiv."status" = 'APPROVED'
ON CONFLICT (
  "teacherProfileId"
)
DO NOTHING;

COMMIT;
