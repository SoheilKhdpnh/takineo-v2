import "server-only";

import { redirect } from "next/navigation";

import {
  getUserAccessContext,
  type UserAccessContext,
} from "@/lib/auth/access";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getRoleHome,
  type UserRole,
} from "@/lib/domain/user-role";

function hasRequiredProfile(
  access: UserAccessContext,
  role: UserRole,
): boolean {
  if (role === "STUDENT") {
    return access.studentProfile !== null;
  }

  return access.teacherProfile !== null;
}

export async function requireAuthenticatedPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const access = await getUserAccessContext(
    session.user.id,
  );

  if (!access) {
    redirect("/sign-in");
  }

  if (access.accountStatus !== "ACTIVE") {
    redirect("/sign-in");
  }

  return {
    session,
    access,
  };
}

export async function requireRolePage(
  requiredRole: UserRole,
) {
  const { session, access } =
    await requireAuthenticatedPage();

  if (!access.role) {
    redirect("/onboarding");
  }

  if (!hasRequiredProfile(access, access.role)) {
    throw new Error(
      "The authenticated user's role and profile are inconsistent.",
    );
  }

  if (access.role !== requiredRole) {
    redirect(getRoleHome(access.role));
  }

  return {
    session,
    access,
  };
}
