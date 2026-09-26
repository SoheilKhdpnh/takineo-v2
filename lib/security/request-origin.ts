import "server-only";

import { isTrustedApplicationOrigin } from "@/lib/security/trusted-origins";

export function hasTrustedRequestOrigin(
  request: Request,
): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return process.env.NODE_ENV !== "production";
  }

  return isTrustedApplicationOrigin(origin);
}
