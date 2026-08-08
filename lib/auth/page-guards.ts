import "server-only";

import {
  getUserAccessContext,
  type UserAccessContext,
} from "@/lib/auth/access";
import { getCurrentSession } from "@/lib/auth/session";
import type { AppLocale } from "@/i18n/routing";
import { redirect as intlRedirect } from "@/i18n/navigation";
import {
  getRoleHome,
  type UserRole,
} from "@/lib/domain/user-role";

// Typed as `never` so TypeScript knows code after this call is unreachable.
function redirect(options: {
  href: string;
  locale: AppLocale;
}): never {
  intlRedirect(options);
  throw new Error(
    "redirect() did not throw as expected.",
  );
}

function hasRequiredProfile(
  access: UserAccessContext,
  role: UserRole,
): boolean {
  if (role === "STUDENT") {
    return access.studentProfile !== null;
  }

  return access.teacherProfile !== null;
}

export async function requireAuthenticatedPage(
  locale: AppLocale,
) {
  const session = await getCurrentSession();

  if (!session) {
    redirect({
      href: "/sign-in",
      locale,
    });
  }

  const access = await getUserAccessContext(
    session.user.id,
  );

  if (!access) {
    redirect({
      href: "/sign-in",
      locale,
    });
  }

  if (access.accountStatus !== "ACTIVE") {
    redirect({ href: "/sign-in", locale });
  }

  return {
    session,
    access,
  };
}

export async function requireRolePage(
  requiredRole: UserRole,
  locale: AppLocale,
) {
  const { session, access } =
    await requireAuthenticatedPage(locale);

  if (!access.role) {
    redirect({
      href: "/onboarding",
      locale,
    });
  }

  if (!hasRequiredProfile(access, access.role)) {
    throw new Error(
      "The authenticated user's role and profile are inconsistent.",
    );
  }

  if (access.role !== requiredRole) {
    redirect({
      href: getRoleHome(access.role),
      locale,
    });
  }

  return {
    session,
    access,
  };
}
