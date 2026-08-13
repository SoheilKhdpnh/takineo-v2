import "server-only";

import type { AppLocale } from "@/i18n/routing";
import { redirect as intlRedirect } from "@/i18n/navigation";
import {
  getCurrentAdminCapabilities,
} from "@/lib/auth/admin-access";
import { getCurrentSession } from "@/lib/auth/session";
import { AdminForbiddenError } from "@/lib/errors/admin-errors";

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

export async function requireAdminPageAccess(
  locale: AppLocale,
) {
  const session = await getCurrentSession();

  if (!session) {
    redirect({
      href: "/sign-in",
      locale,
    });
  }

  try {
    const admin =
      await getCurrentAdminCapabilities(
        session.user.id,
      );

    return {
      session,
      admin,
    };
  } catch (error) {
    if (error instanceof AdminForbiddenError) {
      redirect({
        href: "/dashboard",
        locale,
      });
    }

    throw error;
  }
}
