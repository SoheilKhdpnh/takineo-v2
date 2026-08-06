import "server-only";

import { serverEnv } from "@/lib/env/server";

const trustedApplicationOrigin = new URL(
  serverEnv.BETTER_AUTH_URL,
).origin;

export function hasTrustedRequestOrigin(
  request: Request,
): boolean {
  const requestOrigin =
    request.headers.get("origin");

  if (!requestOrigin) {
    return false;
  }

  return (
    requestOrigin ===
    trustedApplicationOrigin
  );
}