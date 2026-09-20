import { APIError, createAuthMiddleware } from "better-auth/api";

import {
  IRAN_CALLING_CODE,
  isIranMobileNationalNumber,
  toIranE164,
} from "@/lib/domain/iran-phone";
import { isAllowedUsername } from "@/lib/domain/username";

function asSignupBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return {};
  }

  return body as Record<string, unknown>;
}

export const signupAuthHooks = {
  before: createAuthMiddleware(async (ctx) => {
    const body = asSignupBody(ctx.body);

    if (ctx.path === "/phone-number/send-otp") {
      const phoneNumber = body.phoneNumber;

      if (
        typeof phoneNumber !== "string" ||
        !(
          isIranMobileNationalNumber(phoneNumber) ||
          phoneNumber.startsWith("+98")
        )
      ) {
        throw new APIError("BAD_REQUEST", {
          code: "INVALID_PHONE_NUMBER",
          message: "The phone number is not valid.",
        });
      }

      try {
        const e164 = phoneNumber.startsWith("+98")
          ? phoneNumber
          : toIranE164(phoneNumber);

        if (!isIranMobileNationalNumber(e164.slice(IRAN_CALLING_CODE.length))) {
          throw new Error("INVALID_PHONE_NUMBER");
        }
      } catch {
        throw new APIError("BAD_REQUEST", {
          code: "INVALID_PHONE_NUMBER",
          message: "The phone number is not valid.",
        });
      }

      return;
    }

    if (ctx.path !== "/sign-up/email") {
      return;
    }

    if (body.termsAccepted !== true) {
      throw new APIError("BAD_REQUEST", {
        code: "TERMS_NOT_ACCEPTED",
        message: "Terms of use must be accepted.",
      });
    }

    if (
      typeof body.username !== "string" ||
      !isAllowedUsername(body.username)
    ) {
      throw new APIError("BAD_REQUEST", {
        code: "INVALID_USERNAME",
        message: "The username is not valid.",
      });
    }

    if (typeof body.phoneNumber === "string" && body.phoneNumber.length > 0) {
      try {
        const e164 = body.phoneNumber.startsWith("+98")
          ? body.phoneNumber
          : toIranE164(body.phoneNumber);

        if (!isIranMobileNationalNumber(e164.slice(IRAN_CALLING_CODE.length))) {
          throw new Error("INVALID_PHONE_NUMBER");
        }
      } catch {
        throw new APIError("BAD_REQUEST", {
          code: "INVALID_PHONE_NUMBER",
          message: "The phone number is not valid.",
        });
      }
    }
  }),
};
