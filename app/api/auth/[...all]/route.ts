import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/auth";

export const runtime = "nodejs";

<<<<<<< HEAD
export const { GET, POST } =
  toNextJsHandler(auth);
=======
export const GET = auth.handler;
export const POST = auth.handler;
>>>>>>> origin/main
