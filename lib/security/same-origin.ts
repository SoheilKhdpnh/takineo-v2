import "server-only";

import { isTrustedApplicationOrigin } from "@/lib/security/trusted-origins";

export function hasTrustedRequestOrigin(
  request: Request,
): boolean {
  return isTrustedApplicationOrigin(
    request.headers.get("origin"),
  );
}
