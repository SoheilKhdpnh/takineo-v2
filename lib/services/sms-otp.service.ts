import "server-only";

import { APIError } from "better-auth/api";

import {
  isIranE164,
  isIranMobileNationalNumber,
  toIranE164FromInput,
} from "@/lib/domain/iran-phone";
import {
  InvalidSmsPhoneNumberError,
  KavenegarDeliveryError,
  KavenegarNotConfiguredError,
} from "@/lib/errors/sms-errors";
import { sendKavenegarOtp } from "@/lib/providers/kavenegar";

export function isIranOtpPhoneNumber(phoneNumber: string) {
  return (
    isIranE164(phoneNumber) || isIranMobileNationalNumber(phoneNumber)
  );
}

export async function deliverSignupOtp(input: {
  phoneNumber: string;
  code: string;
}) {
  let e164: string;

  try {
    e164 = toIranE164FromInput(input.phoneNumber);
  } catch {
    throw new APIError("BAD_REQUEST", {
      code: "INVALID_PHONE_NUMBER",
      message: "The phone number is not valid.",
    });
  }

  try {
    await sendKavenegarOtp({
      phoneNumber: e164,
      code: input.code,
    });
  } catch (error) {
    if (error instanceof KavenegarNotConfiguredError) {
      throw new APIError("BAD_REQUEST", {
        code: "SMS_PROVIDER_NOT_CONFIGURED",
        message: "SMS OTP is not configured yet.",
      });
    }

    if (error instanceof InvalidSmsPhoneNumberError) {
      throw new APIError("BAD_REQUEST", {
        code: "INVALID_PHONE_NUMBER",
        message: "The phone number is not valid.",
      });
    }

    if (error instanceof KavenegarDeliveryError) {
      throw new APIError("BAD_REQUEST", {
        code: "SMS_DELIVERY_FAILED",
        message: "The verification code could not be sent.",
      });
    }

    throw error;
  }
}