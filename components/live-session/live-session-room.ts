import {
  Room,
  type RoomConnectOptions,
  type RoomOptions,
} from "livekit-client";

export const liveSessionRoomOptions = {
  adaptiveStream: false,
  dynacast: false,
  reconnectPolicy: {
    nextRetryDelayInMs: () => null,
  },
} satisfies RoomOptions;

export const liveSessionConnectOptions = {
  autoSubscribe: true,
  maxRetries: 0,
  peerConnectionTimeout: 30_000,
  websocketTimeout: 20_000,
  rtcConfig: {
    iceTransportPolicy: "all",
  },
} satisfies RoomConnectOptions;

export function createLiveSessionRoom(): Room {
  return new Room(liveSessionRoomOptions);
}
