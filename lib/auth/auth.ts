import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { isActiveAccount, isInactiveAccountSelfServicePath } from "@/lib/auth/account-policy";
import { prisma } from "@/lib/db/prisma";
import { serverEnv } from "@/lib/env/server";

export const auth = betterAuth({
  baseURL: serverEnv.BETTER_AUTH_URL,
  secret: serverEnv.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          return isActiveAccount(session.userId);
        },
      },
      update: {
        before: async (_changes, context) => {
          const userId = context?.context.session?.user.id;
          if (!userId) return false;
          if (isInactiveAccountSelfServicePath(context.path)) return true;
          return isActiveAccount(userId);
        },
      },
    },
  },

  user: {
    additionalFields: {
      role: {
        type: ["STUDENT", "TEACHER"],
        required: false,
        input: false,
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  trustedOrigins: [serverEnv.BETTER_AUTH_URL],

  plugins: [
    // Keep nextCookies as the final plugin.
    nextCookies(),
  ],
});
