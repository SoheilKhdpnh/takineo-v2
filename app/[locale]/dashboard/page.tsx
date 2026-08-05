import { requireAuthenticatedPage } from "@/lib/auth/page-guards";
import { getRoleHome } from "@/lib/domain/user-role";
import { requireAppLocale } from "@/i18n/locale";
import { redirect } from "@/i18n/navigation";

export const dynamic = "force-dynamic";
interface DashboardPageProps {
  params: Promise<{
    locale: string;
  }>;
}


export default async function DashboardPage({
  params,
}: DashboardPageProps) {
  const { locale: requestedLocale } =
    await params;

  const locale = requireAppLocale(
    requestedLocale,
  );

  const { access } =
    await requireAuthenticatedPage(locale);

  if (!access.role) {
    redirect({
      href: "/onboarding",
      locale,
    });
    return;
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

  redirect({
    href: getRoleHome(access.role),
    locale,
  });
}