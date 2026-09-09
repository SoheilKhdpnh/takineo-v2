CREATE INDEX "speaking_session_teacher_start_id_idx"
ON "speaking_session" ("teacherProfileId", "startAt", "id");

CREATE INDEX "speaking_session_student_start_id_idx"
ON "speaking_session" ("studentUserId", "startAt", "id");
