export const USER_ROLES = [
  "STUDENT",
  "TEACHER",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function getRoleHome(role: UserRole): string {
  switch (role) {
    case "STUDENT":
      return "/student/dashboard";

    case "TEACHER":
      return "/teacher/dashboard";
  }
}