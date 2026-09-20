import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber, username } from "better-auth/plugins";

import { isActiveAccount, isInactiveAccountSelfServicePath } from "@/lib/auth/account-policy";
import { signupAuthHooks } from "@/lib/auth/signup-hooks";
import { prisma } from "@/lib/db/prisma";
import { iranPhoneToInternalEmail } from "@/lib/domain/iran-phone";
import { isAllowedUsername } from "@/lib/domain/username";
import { serverEnv } from "@/lib/env/server";
import { isIranOtpPhoneNumber, deliverSignupOtp } from "@/lib/services/sms-otp.service";

export const auth = betterAuth({
  baseURL: serverEnv.BETTER_AUTH_URL,
  secret: serverEnv.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  hooks: signupAuthHooks,

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
    user: {
      create: {
        before: async (user) => {
          const data = {
            ...user,
            termsAccepted: true,
            termsAcceptedAt: new Date(),
          };

          return { data };
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
      phoneNumber: {
        type: "string",
        required: false,
        unique: true,
        input: true,
      },
      phoneNumberVerified: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      termsAccepted: {
        type: "boolean",
        required: true,
        defaultValue: false,
        input: true,
        returned: false,
      },
      termsAcceptedAt: {
        type: "date",
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
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameValidator: isAllowedUsername,
    }),
    phoneNumber({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      requireVerification: true,
      phoneNumberValidator: isIranOtpPhoneNumber,
      signUpOnVerification: {
        getTempEmail: iranPhoneToInternalEmail,
        getTempName: (value) => value,
      },
      sendOTP: async ({ phoneNumber: otpPhoneNumber, code }) => {
        await deliverSignupOtp({
          phoneNumber: otpPhoneNumber,
          code,
        });
      },
      sendPasswordResetOTP: async ({ phoneNumber: otpPhoneNumber, code }) => {
        await deliverSignupOtp({
          phoneNumber: otpPhoneNumber,
          code,
        });
      },
    }),
    // Keep nextCookies as the final plugin.
    nextCookies(),
  ],
});
