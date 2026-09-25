import {
  StudentWorkspacePage,
  type StudentWorkspacePageProps,
} from "@/app/[locale]/student/student-workspace-page";

export default async function StudentProfilePage(
  props: StudentWorkspacePageProps,
) {
  return StudentWorkspacePage(props);
}
