import "server-only";

import { prisma } from "@/lib/db/prisma";

const inactiveAccountSelfServiceEndpoints = new Set([
  "/sign-out",
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
]);

function normalizeBetterAuthPath(path: string) {
  return path.startsWith("/api/auth/") ? path.slice("/api/auth".length) : path;
}

export function isInactiveAccountSelfServicePath(path: string) {
  return inactiveAccountSelfServiceEndpoints.has(normalizeBetterAuthPath(path));
}

export async function getAccountStatusForAuth(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { accountStatus: true } });
  return user?.accountStatus ?? null;
}

export async function isActiveAccount(userId: string) {
  return (await getAccountStatusForAuth(userId)) === "ACTIVE";
}
