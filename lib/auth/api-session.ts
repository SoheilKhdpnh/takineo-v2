import "server-only";

import { isActiveAccount } from "@/lib/auth/account-policy";
import { auth } from "@/lib/auth/auth";

export async function getApiSession(
  request: Request,
) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session) return null;
  return await isActiveAccount(session.user.id) ? session : null;
}
