BEGIN;

-- Required for GiST equality operator classes used by the
-- availability overlap exclusion constraints.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "Weekday" AS ENUM (
  'SATURDAY',
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY'
);

CREATE TYPE "AvailabilityExceptionType" AS ENUM (
  'AVAILABLE',
  'UNAVAILABLE'
);

CREATE TYPE "SpeakingSessionStatus" AS ENUM (
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "SpeakingSessionCancellationActor" AS ENUM (
  'STUDENT',
  'TEACHER',
  'ADMIN',
  'SYSTEM'
);

CREATE TABLE "teacher_availability_rule" (
  "id" TEXT NOT NULL,
  "teacherProfileId" TEXT NOT NULL,
  "weekday" "Weekday" NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "teacher_availability_rule_pkey"
    PRIMARY KEY ("id"),

  CONSTRAINT "tar_minute_window_check"
    CHECK (
      "startMinute" >= 0
      AND "endMinute" <= 1440
      AND "startMinute" < "endMinute"
      AND MOD("startMinute", 15) = 0
      AND MOD("endMinute", 15) = 0
    )
);

CREATE TABLE "teacher_availability_exception" (
  "id" TEXT NOT NULL,
  "teacherProfileId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "type" "AvailabilityExceptionType" NOT NULL,
  "note" VARCHAR(500),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "teacher_availability_exception_pkey"
    PRIMARY KEY ("id"),

  CONSTRAINT "tae_minute_window_check"
    CHECK (
      "startMinute" >= 0
      AND "endMinute" <= 1440
      AND "startMinute" < "endMinute"
      AND MOD("startMinute", 15) = 0
      AND MOD("endMinute", 15) = 0
    ),

  CONSTRAINT "tae_note_check"
    CHECK (
      "note" IS NULL
      OR (
        CHAR_LENGTH(BTRIM("note")) > 0
        AND "note" = BTRIM("note")
      )
    )
);

CREATE TABLE "speaking_session" (
  "id" TEXT NOT NULL,
  "teacherProfileId" TEXT NOT NULL,
  "studentUserId" TEXT NOT NULL,
  "startAt" TIMESTAMPTZ(3) NOT NULL,
  "endAt" TIMESTAMPTZ(3) NOT NULL,
  "status" "SpeakingSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "bookingIdempotencyKey" VARCHAR(128) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "speaking_session_pkey"
    PRIMARY KEY ("id"),

  CONSTRAINT "speaking_session_exact_15m_check"
    CHECK (
      "endAt" = "startAt" + INTERVAL '15 minutes'
    ),

  CONSTRAINT "speaking_session_start_grid_check"
    CHECK (
      "startAt" = date_bin(
        INTERVAL '15 minutes',
        "startAt",
        TIMESTAMPTZ '2000-01-01 00:00:00+00'
      )
    ),

  CONSTRAINT "speaking_session_idempotency_key_check"
    CHECK (
      CHAR_LENGTH(BTRIM("bookingIdempotencyKey")) > 0
      AND "bookingIdempotencyKey" = BTRIM("bookingIdempotencyKey")
    )
);

CREATE TABLE "speaking_session_cancellation" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "actorType" "SpeakingSessionCancellationActor" NOT NULL,
  "actorUserId" TEXT,
  "reason" VARCHAR(1000),
  "cancelledAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "speaking_session_cancellation_pkey"
    PRIMARY KEY ("id"),

  CONSTRAINT "session_cancellation_actor_user_check"
    CHECK (
      (
        "actorType" = 'SYSTEM'
        AND "actorUserId" IS NULL
      )
      OR
      (
        "actorType" <> 'SYSTEM'
        AND "actorUserId" IS NOT NULL
      )
    ),

  CONSTRAINT "session_cancellation_reason_check"
    CHECK (
      "reason" IS NULL
      OR (
        CHAR_LENGTH(BTRIM("reason")) > 0
        AND "reason" = BTRIM("reason")
      )
    )
);

-- Prisma-visible unique/index definitions.

CREATE UNIQUE INDEX "tar_exact_window_key"
ON "teacher_availability_rule"(
  "teacherProfileId",
  "weekday",
  "startMinute",
  "endMinute"
);

CREATE INDEX "tar_teacher_day_lookup_idx"
ON "teacher_availability_rule"(
  "teacherProfileId",
  "weekday",
  "isActive",
  "startMinute"
);

CREATE INDEX "tar_discovery_lookup_idx"
ON "teacher_availability_rule"(
  "weekday",
  "isActive",
  "startMinute",
  "endMinute",
  "teacherProfileId"
);

CREATE UNIQUE INDEX "tae_exact_window_key"
ON "teacher_availability_exception"(
  "teacherProfileId",
  "date",
  "startMinute",
  "endMinute"
);

CREATE INDEX "tae_teacher_date_lookup_idx"
ON "teacher_availability_exception"(
  "teacherProfileId",
  "date",
  "startMinute",
  "endMinute"
);

CREATE INDEX "tae_date_type_lookup_idx"
ON "teacher_availability_exception"(
  "date",
  "type",
  "teacherProfileId"
);

CREATE UNIQUE INDEX "speaking_session_student_idempotency_key"
ON "speaking_session"(
  "studentUserId",
  "bookingIdempotencyKey"
);

CREATE INDEX "speaking_session_teacher_status_start_idx"
ON "speaking_session"(
  "teacherProfileId",
  "status",
  "startAt"
);

CREATE INDEX "speaking_session_student_status_start_idx"
ON "speaking_session"(
  "studentUserId",
  "status",
  "startAt"
);

CREATE INDEX "speaking_session_status_start_idx"
ON "speaking_session"(
  "status",
  "startAt"
);

CREATE UNIQUE INDEX "speaking_session_cancellation_sessionId_key"
ON "speaking_session_cancellation"("sessionId");

CREATE INDEX "session_cancellation_actor_time_idx"
ON "speaking_session_cancellation"(
  "actorUserId",
  "cancelledAt"
);

-- Active availability rules for a teacher may not overlap.
-- [start, end) permits adjacent windows such as 09:00-10:00
-- and 10:00-11:00 without treating them as overlapping.

ALTER TABLE "teacher_availability_rule"
ADD CONSTRAINT "tar_no_active_overlap"
EXCLUDE USING GIST (
  "teacherProfileId" WITH =,
  "weekday" WITH =,
  int4range(
    "startMinute",
    "endMinute",
    '[)'
  ) WITH &&
)
WHERE ("isActive");

-- Date-specific exceptions must also remain unambiguous.
-- AVAILABLE and UNAVAILABLE exception windows cannot overlap
-- each other for the same teacher and date.

ALTER TABLE "teacher_availability_exception"
ADD CONSTRAINT "tae_no_overlap"
EXCLUDE USING GIST (
  "teacherProfileId" WITH =,
  "date" WITH =,
  int4range(
    "startMinute",
    "endMinute",
    '[)'
  ) WITH &&
);

-- Exactly one non-cancelled teacher booking may own a
-- given 15-minute start slot.

CREATE UNIQUE INDEX "speaking_session_teacher_active_slot_key"
ON "speaking_session"(
  "teacherProfileId",
  "startAt"
)
WHERE "status" <> 'CANCELLED';

-- A student also cannot hold two non-cancelled sessions
-- at the same instant, even with different teachers.

CREATE UNIQUE INDEX "speaking_session_student_active_slot_key"
ON "speaking_session"(
  "studentUserId",
  "startAt"
)
WHERE "status" <> 'CANCELLED';

-- Foreign keys.

ALTER TABLE "teacher_availability_rule"
ADD CONSTRAINT "teacher_availability_rule_teacherProfileId_fkey"
FOREIGN KEY ("teacherProfileId")
REFERENCES "teacher_profile"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "teacher_availability_exception"
ADD CONSTRAINT "teacher_availability_exception_teacherProfileId_fkey"
FOREIGN KEY ("teacherProfileId")
REFERENCES "teacher_profile"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "speaking_session"
ADD CONSTRAINT "speaking_session_teacherProfileId_fkey"
FOREIGN KEY ("teacherProfileId")
REFERENCES "teacher_profile"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "speaking_session"
ADD CONSTRAINT "speaking_session_studentUserId_fkey"
FOREIGN KEY ("studentUserId")
REFERENCES "user"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "speaking_session_cancellation"
ADD CONSTRAINT "speaking_session_cancellation_sessionId_fkey"
FOREIGN KEY ("sessionId")
REFERENCES "speaking_session"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "speaking_session_cancellation"
ADD CONSTRAINT "speaking_session_cancellation_actorUserId_fkey"
FOREIGN KEY ("actorUserId")
REFERENCES "user"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMIT;
