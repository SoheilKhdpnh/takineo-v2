import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/auth";

export const runtime = "nodejs";

export const GET = auth.handler;
export const POST = auth.handler;