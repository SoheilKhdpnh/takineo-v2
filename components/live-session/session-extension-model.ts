/** Teacher-chosen continuation after the booked 15 minutes. Not persisted. */
export const SESSION_EXTENSION_TOPIC = "takineo.session-extension";

export const SESSION_EXTENSION_CHOICES = [5, 10] as const;

export type SessionExtensionMinutes = (typeof SESSION_EXTENSION_CHOICES)[number];

export type SessionExtensionDecision = SessionExtensionMinutes | "end";

export function extensionEndAt(
  bookedEndAt: string,
  minutes: SessionExtensionMinutes,
): string {
  return new Date(
    new Date(bookedEndAt).getTime() + minutes * 60_000,
  ).toISOString();
}

export function parseSessionExtensionDecision(
  raw: string,
): SessionExtensionDecision | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const decision = (parsed as { decision?: unknown }).decision;

  if (decision === "end" || decision === 5 || decision === 10) {
    return decision;
  }

  return null;
}
