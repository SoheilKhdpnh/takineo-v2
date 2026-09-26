import {
  describe,
  expect,
  it,
} from "vitest";

import {
  LiveSessionMalformedEventError,
} from "@/lib/errors/live-session-errors";
import {
  mapLiveKitWebhookEvent,
} from "@/lib/live-session/livekit-webhook";
import {
  speakingSessionRoomName,
} from "@/lib/live-session/room-name";

const SESSION_ID = "session-1";
const ROOM_NAME = speakingSessionRoomName(SESSION_ID);
const OCCURRED_AT_SECONDS = 1_787_216_400;

function participantJoined() {
  return {
    event: "participant_joined",
    id: "EV_join_1",
    createdAt: OCCURRED_AT_SECONDS,
    room: {
      sid: "RM_1",
      name: ROOM_NAME,
    },
    participant: {
      sid: "PA_conn_a",
      identity: "lkppr_one",
    },
  };
}

describe("LiveKit webhook mapping", () => {
  it("maps participant_joined onto PARTICIPANT_CONNECTED", () => {
    expect(mapLiveKitWebhookEvent(participantJoined())).toEqual({
      type: "PARTICIPANT_CONNECTED",
      providerEventRef: "EV_join_1",
      sessionId: SESSION_ID,
      occurredAt: new Date(OCCURRED_AT_SECONDS * 1000),
      providerParticipantRef: "lkppr_one",
      connectionRef: "PA_conn_a",
    });
  });

  it("maps participant_left onto PARTICIPANT_DISCONNECTED", () => {
    expect(
      mapLiveKitWebhookEvent({
        ...participantJoined(),
        event: "participant_left",
        id: "EV_leave_1",
      }),
    ).toMatchObject({
      type: "PARTICIPANT_DISCONNECTED",
      providerEventRef: "EV_leave_1",
      connectionRef: "PA_conn_a",
    });
  });

  it("maps room_finished onto ROOM_ENDED without participant fields", () => {
    const mapped = mapLiveKitWebhookEvent({
      event: "room_finished",
      id: "EV_room_1",
      createdAt: OCCURRED_AT_SECONDS,
      room: {
        sid: "RM_1",
        name: ROOM_NAME,
      },
    });

    expect(mapped).toEqual({
      type: "ROOM_ENDED",
      providerEventRef: "EV_room_1",
      sessionId: SESSION_ID,
      occurredAt: new Date(OCCURRED_AT_SECONDS * 1000),
    });
    expect(mapped).not.toHaveProperty("providerParticipantRef");
    expect(mapped).not.toHaveProperty("connectionRef");
  });

  it("ignores unmapped LiveKit event names", () => {
    expect(
      mapLiveKitWebhookEvent({
        event: "track_published",
        id: "EV_track_1",
        createdAt: OCCURRED_AT_SECONDS,
        room: {
          name: ROOM_NAME,
        },
      }),
    ).toBeNull();
  });

  it("ignores rooms that are not speaking-session rooms", () => {
    expect(
      mapLiveKitWebhookEvent({
        ...participantJoined(),
        room: {
          name: "other-room",
        },
      }),
    ).toBeNull();
  });

  it("rejects a mapped join event that is missing participant identity", () => {
    expect(() =>
      mapLiveKitWebhookEvent({
        ...participantJoined(),
        participant: {
          sid: "PA_conn_a",
        },
      }),
    ).toThrow(LiveSessionMalformedEventError);
  });

  it("rejects a mapped event that is missing providerEventRef", () => {
    expect(() =>
      mapLiveKitWebhookEvent({
        ...participantJoined(),
        id: "",
      }),
    ).toThrow(LiveSessionMalformedEventError);
  });
});
