import type { ReactNode } from "react";

import { requireRolePage } from "@/lib/auth/page-guards";

interface TeacherLayoutProps {
  children: ReactNode;
}

export default async function TeacherLayout({
  children,
}: TeacherLayoutProps) {
  await requireRolePage("TEACHER");

  return children;
}