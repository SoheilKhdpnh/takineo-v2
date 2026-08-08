import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const handlers = toNextJsHandler(auth);

const inactiveSecurityPaths = new Set([
  "/api/auth/sign-out",
  "/api/auth/list-sessions",
  "/api/auth/revoke-session",
  "/api/auth/revoke-sessions",
  "/api/auth/revoke-other-sessions",
]);

async function enforceInactiveAccountPolicy(request: Request, handler: (request: Request) => Promise<Response>) {
  const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
  if (session) {
    const account = await prisma.user.findUnique({ where: { id: session.user.id }, select: { accountStatus: true } });
    if (!account || account.accountStatus !== "ACTIVE") {
      const path = new URL(request.url).pathname;
      if (!inactiveSecurityPaths.has(path)) {
        return Response.json({ error: "ACCOUNT_INACTIVE" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
      }
    }
  }
  return handler(request);
}

export function GET(request: Request) {
  return enforceInactiveAccountPolicy(request, handlers.GET);
}

export function POST(request: Request) {
  return enforceInactiveAccountPolicy(request, handlers.POST);
}
