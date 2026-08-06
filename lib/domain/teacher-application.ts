export const TEACHER_APPLICATION_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
] as const;

export type TeacherApplicationStatus =
  (typeof TEACHER_APPLICATION_STATUSES)[number];

export const TEACHER_INTRO_VIDEO_STATUSES = [
  "UPLOAD_PENDING",
  "PROCESSING",
  "READY_FOR_REVIEW",
  "APPROVED",
  "REJECTED",
  "FAILED",
] as const;

export type TeacherIntroVideoStatus =
  (typeof TEACHER_INTRO_VIDEO_STATUSES)[number];

export const TEACHER_VIDEO_MIN_SECONDS = 60;
export const TEACHER_VIDEO_MAX_SECONDS = 120;

export function canEditTeacherApplication(
  status: TeacherApplicationStatus,
): boolean {
  return (
    status === "DRAFT" ||
    status === "REJECTED"
  );
}

export function canSubmitTeacherApplication(
  status: TeacherApplicationStatus,
): boolean {
  return (
    status === "DRAFT" ||
    status === "REJECTED"
  );
}

export function canCreateAvailability(
  status: TeacherApplicationStatus,
): boolean {
  return status === "APPROVED";
}

export function isPublicTeacher(
  applicationStatus: TeacherApplicationStatus,
  profileCompletedAt: Date | null,
  videoStatus: TeacherIntroVideoStatus | null,
): boolean {
  return (
    applicationStatus === "APPROVED" &&
    profileCompletedAt !== null &&
    videoStatus === "APPROVED"
  );
}