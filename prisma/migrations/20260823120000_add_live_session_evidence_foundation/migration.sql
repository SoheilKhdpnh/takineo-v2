-- Wave 3 live speaking evidence foundation.
--
-- Canonical contract: docs/engineering/wave3-live-session-contract.md
--
-- ADDITIVE ONLY. Per contract section 1, this migration must not alter
-- "speaking_session" columns, the "SpeakingSessionStatus" enum, the booking
-- state machine, or any pre-existing booking constraint or index. It creates
-- two new tables and two new enums and nothing else.
--
-- The participant-field shape rule on "speaking_session_live_event" cannot be
-- expressed declaratively in the Prisma schema, so it is hand-written here as
-- "ss_live_event_participant_shape_check".

CREATE TYPE "SpeakingSessionLiveParticipantRole" AS ENUM (
  'STUDENT',
  'TEACHER'
);

CREATE TYPE "SpeakingSessionLiveEventType" AS ENUM (
  'PARTICIPANT_CONNECTED',
  'PARTICIPANT_DISCONNECTED',
  'ROOM_ENDED'
);

-- One row is one credential-issuance authorization.
--
-- No credential material and no grant-level expiry are stored: expiry belongs
-- to the issued provider credential, not to the grant.
CREATE TABLE "speaking_session_live_grant" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "participantUserId" TEXT NOT NULL,
  "participantRole" "SpeakingSessionLiveParticipantRole" NOT NULL,
  "clientJoinAttemptId" VARCHAR(128) NOT NULL,
  "providerParticipantRef" VARCHAR(256) NOT NULL,
  "authorizedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "speaking_session_live_grant_pkey"
    PRIMARY KEY ("id"),

  CONSTRAINT "ss_live_grant_join_attempt_format_check"
    CHECK (
      BTRIM("clientJoinAttemptId") = "clientJoinAttemptId"
      AND LENGTH("clientJoinAttemptId") > 0
    ),

  CONSTRAINT "ss_live_grant_provider_participant_format_check"
    CHECK (
      BTRIM("providerParticipantRef") = "providerParticipantRef"
      AND LENGTH("providerParticipantRef") > 0
    )
);

-- Raw provider evidence only. Derived presence, reconnect counts, and evidence
-- quality are read-time computations and are never persisted here.
CREATE TABLE "speaking_session_live_event" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "providerEventRef" VARCHAR(256) NOT NULL,
  "type" "SpeakingSessionLiveEventType" NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "providerParticipantRef" VARCHAR(256),
  "connectionRef" VARCHAR(256),
  "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "speaking_session_live_event_pkey"
    PRIMARY KEY ("id"),

  CONSTRAINT "ss_live_event_provider_event_format_check"
    CHECK (
      BTRIM("providerEventRef") = "providerEventRef"
      AND LENGTH("providerEventRef") > 0
    ),

  -- A participant event must identify both the provider participant and the
  -- specific connection, because simultaneous connections under one provider
  -- participant are distinct evidence. ROOM_ENDED is room-scoped and must
  -- carry neither, so it can never fabricate participant presence.
  CONSTRAINT "ss_live_event_participant_shape_check"
    CHECK (
      (
        "type" IN (
          'PARTICIPANT_CONNECTED',
          'PARTICIPANT_DISCONNECTED'
        )
        AND "providerParticipantRef" IS NOT NULL
        AND BTRIM("providerParticipantRef") = "providerParticipantRef"
        AND LENGTH("providerParticipantRef") > 0
        AND "connectionRef" IS NOT NULL
        AND BTRIM("connectionRef") = "connectionRef"
        AND LENGTH("connectionRef") > 0
      )
      OR (
        "type" = 'ROOM_ENDED'
        AND "providerParticipantRef" IS NULL
        AND "connectionRef" IS NULL
      )
    )
);

CREATE INDEX "ss_live_grant_session_role_idx" ON "speaking_session_live_grant"("sessionId", "participantRole", "authorizedAt");

-- Contract section 5: a providerParticipantRef belongs to exactly one grant.
CREATE UNIQUE INDEX "ss_live_grant_provider_participant_key" ON "speaking_session_live_grant"("providerParticipantRef");

-- Contract section 5: a replayed join attempt must not mint a second grant.
CREATE UNIQUE INDEX "ss_live_grant_join_attempt_key" ON "speaking_session_live_grant"("participantUserId", "clientJoinAttemptId");

CREATE INDEX "ss_live_event_session_time_idx" ON "speaking_session_live_event"("sessionId", "occurredAt", "providerEventRef");

CREATE INDEX "ss_live_event_connection_idx" ON "speaking_session_live_event"("providerParticipantRef", "connectionRef", "occurredAt");

-- Contract section 6: duplicate provider delivery is a database-level no-op
-- rather than an application-level guess.
CREATE UNIQUE INDEX "ss_live_event_provider_event_key" ON "speaking_session_live_event"("providerEventRef");

ALTER TABLE "speaking_session_live_grant" ADD CONSTRAINT "speaking_session_live_grant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "speaking_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "speaking_session_live_grant" ADD CONSTRAINT "speaking_session_live_grant_participantUserId_fkey" FOREIGN KEY ("participantUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "speaking_session_live_event" ADD CONSTRAINT "speaking_session_live_event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "speaking_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
