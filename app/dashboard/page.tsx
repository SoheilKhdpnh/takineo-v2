import { redirect } from "next/navigation";

import { requireAuthenticatedPage } from "@/lib/auth/page-guards";
import { getRoleHome } from "@/lib/domain/user-role";

export default async function DashboardPage() {
  const { access } =
    await requireAuthenticatedPage();

  if (!access.role) {
    redirect("/onboarding");
  }

  if (
    access.role === "STUDENT" &&
    !access.studentProfile
  ) {
    throw new Error(
      "Student role exists without StudentProfile.",
    );
  }

  if (
    access.role === "TEACHER" &&
    !access.teacherProfile
  ) {
    throw new Error(
      "Teacher role exists without TeacherProfile.",
    );
  }

  redirect(getRoleHome(access.role));
}