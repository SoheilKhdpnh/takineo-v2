import "server-only";

import { auth } from "@/lib/auth/auth";

export function getApiSession(
  request: Request,
) {
  return auth.api.getSession({
    headers: request.headers,
  });
}