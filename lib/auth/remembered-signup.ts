const STORAGE_KEY = "talkinu.auth.remembered-signup";

export type RememberedSignup = {
  method: "email" | "phone";
  username: string;
  email?: string;
  phoneNationalNumber?: string;
};

function isRememberedSignup(value: unknown): value is RememberedSignup {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as RememberedSignup;

  return (
    (candidate.method === "email" || candidate.method === "phone") &&
    typeof candidate.username === "string" &&
    (candidate.email === undefined || typeof candidate.email === "string") &&
    (candidate.phoneNationalNumber === undefined ||
      typeof candidate.phoneNationalNumber === "string")
  );
}

export function readRememberedSignup(): RememberedSignup | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    return isRememberedSignup(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeRememberedSignup(value: RememberedSignup) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function clearRememberedSignup() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
