import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isLiveSessionParticipantPresenceEvent,
  type LiveSessionCredentialGrant,
  type LiveSessionProviderAdapter,
  type LiveSessionProviderEvidenceEvent,
} from "@/lib/domain/live-session/provider";

function grant(
  overrides:
    Partial<LiveSessionCredentialGrant> = {},
): LiveSessionCredentialGrant {
  return {
    grantId:
      "grant-1",

    sessionId:
      "session-1",

    clientJoinAttemptId:
      "join-attempt-1",

    participantUserId:
      "student-user",

    participantRole:
      "STUDENT",

    providerParticipantRef:
      "opaque-provider-participant-1",

    authorizedAt:
      new Date(
        "2026-08-20T09:59:00.000Z",
      ),

    ...overrides,
  };
}

describe(
  "Wave 3 live-session provider contract",
  () => {
    it(
      "keeps join-attempt, grant, provider participant, and Takineo user identities distinct",
      () => {
        const value =
          grant();

        expect(
          value.clientJoinAttemptId,
        ).not.toBe(
          value.grantId,
        );

        expect(
          value.providerParticipantRef,
        ).not.toBe(
          value.participantUserId,
        );

        expect(
          value,
        ).not.toHaveProperty(
          "expiresAt",
        );
      },
    );

    it(
      "supports a unique provider participant identity for each grant attempt",
      () => {
        const first =
          grant();

        const second =
          grant({
            grantId:
              "grant-2",

            providerParticipantRef:
              "opaque-provider-participant-2",
          });

        expect(
          second.grantId,
        ).not.toBe(
          first.grantId,
        );

        expect(
          second.providerParticipantRef,
        ).not.toBe(
          first.providerParticipantRef,
        );
      },
    );

    it(
      "keeps credential issuance distinct from natural expiration and explicit revocation",
      async () => {
        const effects:
          string[] = [];

        const adapter:
          LiveSessionProviderAdapter = {
            async issueCredential(
              command,
            ) {
              effects.push(
                `issue:${command.grant.grantId}`,
              );

              return {
                credential:
                  "opaque-provider-credential",

                expiresAt:
                  new Date(
                    "2026-08-20T10:20:00.000Z",
                  ),
              };
            },

            async revokeCredential(
              command,
            ) {
              effects.push(
                `revoke:${command.grantId}`,
              );
            },
          };

        const issued =
          await adapter.issueCredential({
            grant:
              grant(),
          });

        expect(
          issued.expiresAt,
        ).toEqual(
          new Date(
            "2026-08-20T10:20:00.000Z",
          ),
        );

        /*
         * Merely having an expiration timestamp does not create an explicit
         * revocation effect.
         */
        expect(
          effects,
        ).toEqual([
          "issue:grant-1",
        ]);

        await adapter.revokeCredential({
          grantId:
            "grant-1",

          providerParticipantRef:
            "opaque-provider-participant-1",
        });

        expect(
          effects,
        ).toEqual([
          "issue:grant-1",
          "revoke:grant-1",
        ]);
      },
    );

    it(
      "keeps simultaneous connections separate under the same provider participant",
      () => {
        const events:
          LiveSessionProviderEvidenceEvent[] = [
            {
              type:
                "PARTICIPANT_CONNECTED",

              providerEventRef:
                "provider-event-1",

              sessionId:
                "session-1",

              occurredAt:
                new Date(
                  "2026-08-20T10:00:00.000Z",
                ),

              providerParticipantRef:
                "opaque-provider-participant-1",

              connectionRef:
                "connection-a",
            },
            {
              type:
                "PARTICIPANT_CONNECTED",

              providerEventRef:
                "provider-event-2",

              sessionId:
                "session-1",

              occurredAt:
                new Date(
                  "2026-08-20T10:00:05.000Z",
                ),

              providerParticipantRef:
                "opaque-provider-participant-1",

              connectionRef:
                "connection-b",
            },
          ];

        expect(
          events.every(
            isLiveSessionParticipantPresenceEvent,
          ),
        ).toBe(
          true,
        );

        expect(
          events[0],
        ).toMatchObject({
          providerParticipantRef:
            "opaque-provider-participant-1",

          connectionRef:
            "connection-a",
        });

        expect(
          events[1],
        ).toMatchObject({
          providerParticipantRef:
            "opaque-provider-participant-1",

          connectionRef:
            "connection-b",
        });
      },
    );

    it(
      "keeps ROOM_ENDED room-scoped rather than fabricating participant evidence",
      () => {
        const event:
          LiveSessionProviderEvidenceEvent = {
            type:
              "ROOM_ENDED",

            providerEventRef:
              "provider-room-event-1",

            sessionId:
              "session-1",

            occurredAt:
              new Date(
                "2026-08-20T10:16:00.000Z",
              ),
          };

        expect(
          isLiveSessionParticipantPresenceEvent(
            event,
          ),
        ).toBe(
          false,
        );

        expect(
          event,
        ).not.toHaveProperty(
          "providerParticipantRef",
        );

        expect(
          event,
        ).not.toHaveProperty(
          "connectionRef",
        );
      },
    );
  },
);
