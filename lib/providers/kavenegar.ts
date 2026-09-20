import "server-only";

import { z } from "zod";

import { toKavenegarReceptor } from "@/lib/domain/iran-phone";
import {
  InvalidSmsPhoneNumberError,
  KavenegarDeliveryError,
  KavenegarNotConfiguredError,
} from "@/lib/errors/sms-errors";

const kavenegarEnvironmentSchema = z.object({
  KAVENEGAR_API_KEY: z.string().trim().min(1),
  KAVENEGAR_OTP_TEMPLATE: z.string().trim().min(1),
});

const kavenegarResponseSchema = z.object({
  return: z.object({
    status: z.number(),
  }),
});

export function hasKavenegarConfiguration() {
  return kavenegarEnvironmentSchema.safeParse({
    KAVENEGAR_API_KEY: process.env.KAVENEGAR_API_KEY,
    KAVENEGAR_OTP_TEMPLATE: process.env.KAVENEGAR_OTP_TEMPLATE,
  }).success;
}

export function getKavenegarConfiguration() {
  const parsed = kavenegarEnvironmentSchema.safeParse({
    KAVENEGAR_API_KEY: process.env.KAVENEGAR_API_KEY,
    KAVENEGAR_OTP_TEMPLATE: process.env.KAVENEGAR_OTP_TEMPLATE,
  });

  if (!parsed.success) {
    throw new KavenegarNotConfiguredError();
  }

  return {
    apiKey: parsed.data.KAVENEGAR_API_KEY,
    otpTemplate: parsed.data.KAVENEGAR_OTP_TEMPLATE,
  };
}

export async function sendKavenegarOtp(input: {
  phoneNumber: string;
  code: string;
}) {
  const { apiKey, otpTemplate } = getKavenegarConfiguration();

  let receptor: string;

  try {
    receptor = toKavenegarReceptor(input.phoneNumber);
  } catch {
    throw new InvalidSmsPhoneNumberError();
  }

  const endpoint = new URL(
    `https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/verify/lookup.json`,
  );

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: new URLSearchParams({
      receptor,
      token: input.code,
      template: otpTemplate,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new KavenegarDeliveryError();
  }

  const parsed = kavenegarResponseSchema.safeParse(payload);

  if (!parsed.success || parsed.data.return.status !== 200) {
    throw new KavenegarDeliveryError();
  }
}