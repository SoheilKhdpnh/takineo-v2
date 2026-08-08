import { toNextJsHandler } from "better-auth/next-js";

import { getAccountStatusForAuth, isInactiveAccountSelfServicePath } from "@/lib/auth/account-policy";
import { auth } from "@/lib/auth/auth";

export const runtime = "nodejs";

const handlers = toNextJsHandler(auth);

async function enforceInactiveAccountPolicy(request: Request, handler: (request: Request) => Promise<Response>) {
  const path = new URL(request.url).pathname;
  if (path === "/api/auth/sign-out") return handler(request);
  const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true, disableRefresh: true } });
  if (session) {
    const accountStatus = await getAccountStatusForAuth(session.user.id);
    if (accountStatus !== "ACTIVE" && !isInactiveAccountSelfServicePath(path)) {
      return Response.json({ error: "ACCOUNT_INACTIVE" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
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
