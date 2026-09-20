import "server-only";

import { prisma } from "@/lib/db/prisma";

const inactiveAccountSelfServiceEndpoints = new Set([
  "/sign-out",
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
]);

export type AuthAccountStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";

function normalizeBetterAuthPath(path: string) {
  return path.startsWith("/api/auth/") ? path.slice("/api/auth".length) : path;
}

export function isInactiveAccountSelfServicePath(path: string) {
  return inactiveAccountSelfServiceEndpoints.has(normalizeBetterAuthPath(path));
}

export function isEmailSignupPath(path?: string | null) {
  if (!path) {
    return false;
  }

  return normalizeBetterAuthPath(path) === "/sign-up/email";
}

export async function getAccountStatusForAuth(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountStatus: true },
  });
  return user?.accountStatus ?? null;
}

export async function isActiveAccount(userId: string) {
  return (await getAccountStatusForAuth(userId)) === "ACTIVE";
}

export function canCreateAuthSession(input: {
  accountStatus: AuthAccountStatus | null;
  path?: string | null;
}): boolean {
  if (input.accountStatus === "ACTIVE") {
    return true;
  }

  if (
    input.accountStatus === "SUSPENDED" ||
    input.accountStatus === "DISABLED"
  ) {
    return false;
  }

  /*
   * A missing row is fail-closed on sign-in and every other path.
   * Otherwise a lag-hidden SUSPENDED/DISABLED user would mint a
   * session as if they were a new ACTIVE account.
   *
   * Email signup is the one exception: schema default is ACTIVE, and
   * Better Auth may create the session before a follow-up read sees
   * the new row. That exception is path-gated, not a generic null→ACTIVE
   * conversion.
   */
  return isEmailSignupPath(input.path);
}
