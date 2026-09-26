export type SessionViewerRole = "STUDENT" | "TEACHER";

export type SessionJoinCounterparty = {
  name: string;
  image: string | null;
};

export type SessionJoinContext = {
  sessionId: string;
  viewerRole: SessionViewerRole;
  selfName: string;
  selfImage: string | null;
  counterparty: SessionJoinCounterparty;
  startAt: string;
  endAt: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
};

export type ConnectionQualityLevel =
  | "excellent"
  | "good"
  | "poor"
  | "lost"
  | "unknown";

export type WrapUpReason =
  | "leave"
  | "time"
  | "windowClosed"
  | "cancelled"
  | "completed";

export function isStrugglingQuality(
  quality: ConnectionQualityLevel,
): boolean {
  return quality === "poor" || quality === "lost";
}

export type JoinSuccessBody = {
  credential: string;
  url: string;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseJoinSuccess(
  value: unknown,
): JoinSuccessBody | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.credential !== "string" ||
    value.credential.length === 0 ||
    typeof value.url !== "string" ||
    !(
      value.url.startsWith("ws://") ||
      value.url.startsWith("wss://")
    )
  ) {
    return null;
  }

  return {
    credential: value.credential,
    url: value.url,
  };
}

function joinAttemptStorageKey(sessionId: string): string {
  return `takineo:live-join-attempt:${sessionId}`;
}

export function readOrCreateJoinAttemptId(sessionId: string): string {
  const key = joinAttemptStorageKey(sessionId);

  try {
    const existing = sessionStorage.getItem(key);

    if (existing && existing.length > 0) {
      return existing;
    }

    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function clearJoinAttemptId(sessionId: string) {
  try {
    sessionStorage.removeItem(joinAttemptStorageKey(sessionId));
  } catch {
    // sessionStorage can throw in a locked browser context.
  }
}
