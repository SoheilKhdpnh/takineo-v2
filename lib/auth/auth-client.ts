<<<<<<< HEAD
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "@/lib/auth/auth";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
  ],
});
=======
"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
>>>>>>> origin/main
