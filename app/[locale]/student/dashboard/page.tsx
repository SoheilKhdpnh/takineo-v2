import {
  StudentWorkspacePage,
  type StudentWorkspacePageProps,
} from "@/app/[locale]/student/student-workspace-page";

export default async function StudentDashboardPage(
  props: StudentWorkspacePageProps,
) {
  return StudentWorkspacePage(props);
}
