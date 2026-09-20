export const LIVEKIT_SPEAKING_ROOM_PREFIX = "spk_";

export function speakingSessionRoomName(
  sessionId: string,
): string {
  return `${LIVEKIT_SPEAKING_ROOM_PREFIX}${sessionId}`;
}

export function sessionIdFromLiveKitRoomName(
  roomName: string,
): string | null {
  if (!roomName.startsWith(LIVEKIT_SPEAKING_ROOM_PREFIX)) {
    return null;
  }

  const sessionId = roomName.slice(LIVEKIT_SPEAKING_ROOM_PREFIX.length);

  if (sessionId.length === 0 || sessionId !== sessionId.trim() || /\s/.test(sessionId)) {
    return null;
  }

  return sessionId;
}
