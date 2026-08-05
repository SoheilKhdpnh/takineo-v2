import "server-only";

import { serverEnv } from "@/lib/env/server";

const trustedOrigin = new URL(
  serverEnv.BETTER_AUTH_URL,
).origin;

export function hasTrustedRequestOrigin(
  request: Request,
): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return process.env.NODE_ENV !== "production";
  }

  try {
    return new URL(origin).origin === trustedOrigin;
  } catch {
    return false;
  }
}