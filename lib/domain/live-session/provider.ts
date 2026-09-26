import type {
  LiveSessionParticipantRole,
} from "@/lib/domain/live-session/policy";

/**
 * A providerParticipantRef is opaque provider identity belonging to exactly
 * one credential grant.
 *
 * It is not a Takineo user identifier and is not a session-wide participant
 * identifier.
 */
export type LiveSessionCredentialGrant =
  Readonly<{
    grantId:
      string;

    sessionId:
      string;

    clientJoinAttemptId:
      string;

    participantUserId:
      string;

    participantRole:
      LiveSessionParticipantRole;

    providerParticipantRef:
      string;

    authorizedAt:
      Date;
  }>;

/**
 * One grant represents one credential-issuance attempt.
 *
 * Issuance is still a provider effect distinct from grant authorization.
 */
export type LiveSessionCredentialIssuanceCommand =
  Readonly<{
    grant:
      LiveSessionCredentialGrant;
  }>;

export type LiveSessionIssuedCredential =
  Readonly<{
    credential:
      string;

    expiresAt:
      Date;
  }>;

export type LiveSessionExplicitRevocationCommand =
  Readonly<{
    grantId:
      string;

    providerParticipantRef:
      string;
  }>;

export type LiveSessionProviderAdapter =
  Readonly<{
    issueCredential: (
      command:
        LiveSessionCredentialIssuanceCommand,
    ) => Promise<LiveSessionIssuedCredential>;

    revokeCredential: (
      command:
        LiveSessionExplicitRevocationCommand,
    ) => Promise<void>;
  }>;

type LiveSessionProviderEventBase =
  Readonly<{
    providerEventRef:
      string;

    sessionId:
      string;

    occurredAt:
      Date;
  }>;

export type LiveSessionParticipantConnectedEvent =
  LiveSessionProviderEventBase &
  Readonly<{
    type:
      "PARTICIPANT_CONNECTED";

    providerParticipantRef:
      string;

    connectionRef:
      string;
  }>;

export type LiveSessionParticipantDisconnectedEvent =
  LiveSessionProviderEventBase &
  Readonly<{
    type:
      "PARTICIPANT_DISCONNECTED";

    providerParticipantRef:
      string;

    connectionRef:
      string;
  }>;

export type LiveSessionRoomEndedEvent =
  LiveSessionProviderEventBase &
  Readonly<{
    type:
      "ROOM_ENDED";
  }>;

export type LiveSessionProviderEvidenceEvent =
  | LiveSessionParticipantConnectedEvent
  | LiveSessionParticipantDisconnectedEvent
  | LiveSessionRoomEndedEvent;

export type LiveSessionParticipantPresenceEvent =
  | LiveSessionParticipantConnectedEvent
  | LiveSessionParticipantDisconnectedEvent;

export function isLiveSessionParticipantPresenceEvent(
  event:
    LiveSessionProviderEvidenceEvent,
): event is LiveSessionParticipantPresenceEvent {
  return (
    event.type ===
      "PARTICIPANT_CONNECTED" ||
    event.type ===
      "PARTICIPANT_DISCONNECTED"
  );
}
