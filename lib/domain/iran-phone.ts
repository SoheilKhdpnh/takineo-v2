export const IRAN_CALLING_CODE = "+98";
export const IRAN_MOBILE_EXAMPLE = "9142928321";

const iranMobileNationalPattern = /^9\d{9}$/;

export function normalizeIranMobileNationalNumber(value: string) {
  return value.replace(/[\s-]/g, "").trim();
}

export function isIranMobileNationalNumber(value: string) {
  return iranMobileNationalPattern.test(
    normalizeIranMobileNationalNumber(value),
  );
}

export function toIranE164(nationalNumber: string) {
  const normalized = normalizeIranMobileNationalNumber(nationalNumber);

  if (!isIranMobileNationalNumber(normalized)) {
    throw new Error("INVALID_PHONE_NUMBER");
  }

  return `${IRAN_CALLING_CODE}${normalized}`;
}

export function iranPhoneToInternalEmail(e164: string) {
  const digits = e164.replace(/^\+/, "");
  return `${digits}@phone.talkinu.invalid`;
}

export function isIranE164(value: string) {
  return /^\+989\d{9}$/.test(value.trim());
}

export function toIranE164FromInput(value: string) {
  const trimmed = value.trim();

  if (isIranE164(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("98") && isIranE164(`+${trimmed}`)) {
    return `+${trimmed}`;
  }

  return toIranE164(trimmed);
}

export function toKavenegarReceptor(e164: string) {
  const normalized = toIranE164FromInput(e164);
  return normalized.slice(1);
}
