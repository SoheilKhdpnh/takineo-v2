import "server-only";

import { randomInt } from "node:crypto";

const VERIFICATION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const VIDEO_VERIFICATION_CODE_LENGTH = 5;

export function generateVideoVerificationCode(): string {
  let code = "";

  for (let index = 0; index < VIDEO_VERIFICATION_CODE_LENGTH; index += 1) {
    code += VERIFICATION_CODE_ALPHABET[randomInt(VERIFICATION_CODE_ALPHABET.length)];
  }

  return code;
}
