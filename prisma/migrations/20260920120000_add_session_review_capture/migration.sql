-- Wave 3 capture-only student rating of a speaking session.
--
-- Canonical contract: docs/engineering/wave3-live-session-contract.md
--
-- ADDITIVE ONLY. This table stores a single student-to-teacher rating plus an
-- optional short comment. It must not alter existing "speaking_session"
-- columns, statuses, or booking constraints.
--
-- Aggregation, profile surfacing, comment moderation, and teacher-rates-student
-- are intentionally deferred to Wave 5.

CREATE TABLE "session_review" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "studentUserId" TEXT NOT NULL,
  "teacherUserId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" VARCHAR(500),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "session_review_pkey"
    PRIMARY KEY ("id"),

  CONSTRAINT "session_review_rating_range_check"
    CHECK ("rating" >= 1 AND "rating" <= 5),

  CONSTRAINT "session_review_comment_format_check"
    CHECK (
      "comment" IS NULL
      OR (
        BTRIM("comment") = "comment"
        AND LENGTH("comment") > 0
      )
    )
);

CREATE UNIQUE INDEX "session_review_sessionId_key"
  ON "session_review" ("sessionId");

CREATE INDEX "session_review_student_idx"
  ON "session_review" ("studentUserId");

CREATE INDEX "session_review_teacher_idx"
  ON "session_review" ("teacherUserId");

ALTER TABLE "session_review"
  ADD CONSTRAINT "session_review_sessionId_fkey"
  FOREIGN KEY ("sessionId")
  REFERENCES "speaking_session" ("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "session_review"
  ADD CONSTRAINT "session_review_studentUserId_fkey"
  FOREIGN KEY ("studentUserId")
  REFERENCES "user" ("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "session_review"
  ADD CONSTRAINT "session_review_teacherUserId_fkey"
  FOREIGN KEY ("teacherUserId")
  REFERENCES "user" ("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
