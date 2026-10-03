/**
 * In-session chat is ephemeral: messages travel over the LiveKit room's text
 * streams and live only in browser memory. Nothing is persisted server-side.
 */
export const SESSION_CHAT_TOPIC = "takineo.session-chat";

export const SESSION_CHAT_MAX_LENGTH = 500;

/** UTF-8 upper bound for a maximum-length message; larger streams are not read. */
export const SESSION_CHAT_MAX_BYTES = SESSION_CHAT_MAX_LENGTH * 4;

/** Bounds browser memory for a 15-minute session. */
export const SESSION_CHAT_MAX_MESSAGES = 200;

export type SessionChatAuthor = "self" | "remote";

export type SessionChatMessage = {
  id: string;
  author: SessionChatAuthor;
  text: string;
  sentAt: number;
};

export function normalizeOutgoingChatText(raw: string): string | null {
  const text = raw.trim();

  if (text.length === 0 || text.length > SESSION_CHAT_MAX_LENGTH) {
    return null;
  }

  return text;
}

/**
 * The counterpart's client is untrusted: drop empty payloads and clamp
 * oversized ones instead of rendering arbitrary amounts of text.
 */
export function normalizeIncomingChatText(raw: string): string | null {
  const text = raw.trim();

  if (text.length === 0) {
    return null;
  }

  return text.slice(0, SESSION_CHAT_MAX_LENGTH);
}

export function appendChatMessage(
  messages: readonly SessionChatMessage[],
  message: SessionChatMessage,
): SessionChatMessage[] {
  const next = [...messages, message];

  return next.length > SESSION_CHAT_MAX_MESSAGES
    ? next.slice(next.length - SESSION_CHAT_MAX_MESSAGES)
    : next;
}
