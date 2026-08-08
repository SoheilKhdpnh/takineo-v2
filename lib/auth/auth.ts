import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

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
          const active = await prisma.user.count({ where: { id: session.userId, accountStatus: "ACTIVE" } });
          return active === 1;
        },
      },
      update: {
        before: async (session) => {
          const userId = session.userId ?? (session.id ? (await prisma.session.findUnique({ where: { id: session.id }, select: { userId: true } }))?.userId : null);
          if (!userId) return false;
          const active = await prisma.user.count({ where: { id: userId, accountStatus: "ACTIVE" } });
          return active === 1;
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
