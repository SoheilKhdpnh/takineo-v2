/**
 * Whiteboard sync protocol over the LiveKit room. Pure functions only so the
 * merge rules are testable without Excalidraw or a room.
 *
 * Nothing here is persisted: the board lives in each participant's memory.
 */
export const WHITEBOARD_TOPIC = "takineo.session-board";

/** Per-message cap; larger updates are split across messages. */
export const WHITEBOARD_MAX_MESSAGE_BYTES = 256 * 1024;

/** Upper bound for a two-person, 15-minute board; extra elements are ignored. */
export const WHITEBOARD_MAX_ELEMENTS = 3000;

const MAX_ELEMENT_ID_LENGTH = 64;

const utf8 = new TextEncoder();

/**
 * Minimal shape the sync layer relies on. Full element validation is done by
 * Excalidraw's `restoreElements` before anything reaches the canvas.
 */
export type BoardElement = {
  id: string;
  version: number;
  versionNonce: number;
  isDeleted?: boolean;
} & Record<string, unknown>;

export type WhiteboardMessage =
  | { kind: "update"; elements: BoardElement[] }
  | { kind: "snapshot"; elements: BoardElement[] }
  | { kind: "snapshot-request" }
  | { kind: "permission"; studentCanDraw: boolean };

function isBoardElement(value: unknown): value is BoardElement {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    candidate.id.length <= MAX_ELEMENT_ID_LENGTH &&
    typeof candidate.version === "number" &&
    Number.isSafeInteger(candidate.version) &&
    typeof candidate.versionNonce === "number" &&
    Number.isFinite(candidate.versionNonce)
  );
}

/** Parses an untrusted message from the counterpart; returns null if invalid. */
export function parseWhiteboardMessage(raw: string): WhiteboardMessage | null {
  if (raw.length > WHITEBOARD_MAX_MESSAGE_BYTES) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const message = parsed as Record<string, unknown>;

  if (message.kind === "snapshot-request") {
    return { kind: "snapshot-request" };
  }

  if (message.kind === "permission") {
    return typeof message.studentCanDraw === "boolean"
      ? { kind: "permission", studentCanDraw: message.studentCanDraw }
      : null;
  }

  if (
    (message.kind !== "update" && message.kind !== "snapshot") ||
    !Array.isArray(message.elements)
  ) {
    return null;
  }

  const elements = message.elements
    .slice(0, WHITEBOARD_MAX_ELEMENTS)
    .filter(isBoardElement);

  return { kind: message.kind, elements };
}

/** Excalidraw's rule: higher version wins; on a tie the lower nonce wins. */
export function isNewerElement(
  incoming: BoardElement,
  current: BoardElement | undefined,
): boolean {
  if (!current) {
    return true;
  }

  if (incoming.version !== current.version) {
    return incoming.version > current.version;
  }

  return incoming.versionNonce < current.versionNonce;
}

export function mergeBoardElements(
  current: ReadonlyMap<string, BoardElement>,
  incoming: readonly BoardElement[],
): { next: Map<string, BoardElement>; changed: BoardElement[] } {
  const next = new Map(current);
  const changed: BoardElement[] = [];

  for (const element of incoming) {
    if (!next.has(element.id) && next.size >= WHITEBOARD_MAX_ELEMENTS) {
      continue;
    }

    if (isNewerElement(element, next.get(element.id))) {
      next.set(element.id, element);
      changed.push(element);
    }
  }

  return { next, changed };
}

/**
 * Elements whose version differs from what was last sent or received, so
 * remote changes applied locally are not echoed back.
 */
export function elementsToSend(
  elements: readonly BoardElement[],
  knownVersions: ReadonlyMap<string, number>,
): BoardElement[] {
  return elements.filter(
    (element) => knownVersions.get(element.id) !== element.version,
  );
}

/** Splits elements into JSON messages that each fit the byte cap. */
export function encodeWhiteboardMessages(
  kind: "update" | "snapshot",
  elements: readonly BoardElement[],
): string[] {
  const messages: string[] = [];
  let batch: BoardElement[] = [];
  let batchBytes = 0;
  const envelopeBytes = 64;

  for (const element of elements) {
    const elementBytes = utf8.encode(JSON.stringify(element)).length + 1;

    if (elementBytes + envelopeBytes > WHITEBOARD_MAX_MESSAGE_BYTES) {
      continue;
    }

    if (batchBytes + elementBytes + envelopeBytes > WHITEBOARD_MAX_MESSAGE_BYTES) {
      messages.push(JSON.stringify({ kind, elements: batch }));
      batch = [];
      batchBytes = 0;
    }

    batch.push(element);
    batchBytes += elementBytes;
  }

  if (batch.length > 0 || (kind === "snapshot" && messages.length === 0)) {
    messages.push(JSON.stringify({ kind, elements: batch }));
  }

  return messages;
}
