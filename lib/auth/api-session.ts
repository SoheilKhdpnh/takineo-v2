import "server-only";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

export async function getApiSession(
  request: Request,
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session) return null;
  const active = await prisma.user.count({
    where: { id: session.user.id, accountStatus: "ACTIVE" },
  });
  return active === 1 ? session : null;
}
