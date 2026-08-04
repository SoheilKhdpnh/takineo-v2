import type { ReactNode } from "react";

import { requireRolePage } from "@/lib/auth/page-guards";

interface StudentLayoutProps {
  children: ReactNode;
}

export default async function StudentLayout({
  children,
}: StudentLayoutProps) {
  await requireRolePage("STUDENT");

  return children;
}