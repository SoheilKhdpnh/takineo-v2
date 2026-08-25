import {
  describe,
  expect,
  it,
} from "vitest";

import {
  getLiveSessionConstraintIdentity,
  LIVE_SESSION_CONSTRAINT,
} from "@/lib/live-session/constraint-identity";
import {
  makePrismaKnownRequestError,
  makeUniqueConstraintError,
} from "@/tests/unit/live-session/prisma-error";

describe("live-session constraint identity", () => {
  it("classifies unique conflicts by PostgreSQL constraint name", () => {
    expect(
      getLiveSessionConstraintIdentity(
        makeUniqueConstraintError(
          LIVE_SESSION_CONSTRAINT.GRANT_JOIN_ATTEMPT,
          "SpeakingSessionLiveGrant",
          ["participantUserId", "clientJoinAttemptId"],
        ),
      ),
    ).toBe(LIVE_SESSION_CONSTRAINT.GRANT_JOIN_ATTEMPT);

    expect(
      getLiveSessionConstraintIdentity(
        makeUniqueConstraintError(
          LIVE_SESSION_CONSTRAINT.GRANT_PROVIDER_PARTICIPANT,
          "SpeakingSessionLiveGrant",
          ["providerParticipantRef"],
        ),
      ),
    ).toBe(LIVE_SESSION_CONSTRAINT.GRANT_PROVIDER_PARTICIPANT);

    expect(
      getLiveSessionConstraintIdentity(
        makeUniqueConstraintError(
          LIVE_SESSION_CONSTRAINT.EVENT_PROVIDER_EVENT,
          "SpeakingSessionLiveEvent",
          ["providerEventRef"],
        ),
      ),
    ).toBe(LIVE_SESSION_CONSTRAINT.EVENT_PROVIDER_EVENT);
  });

  it("maps Prisma unique targets when the driver omits the constraint name", () => {
    expect(
      getLiveSessionConstraintIdentity(
        makePrismaKnownRequestError("P2002", {
          modelName: "SpeakingSessionLiveGrant",
          target: ["clientJoinAttemptId", "participantUserId"],
        }),
      ),
    ).toBe(LIVE_SESSION_CONSTRAINT.GRANT_JOIN_ATTEMPT);
  });

  it("classifies the participant-field CHECK by constraint identity", () => {
    expect(
      getLiveSessionConstraintIdentity(
        makePrismaKnownRequestError("P2010", {
          driverAdapterError: {
            cause: {
              originalCode: "23514",
              constraint:
                LIVE_SESSION_CONSTRAINT.EVENT_PARTICIPANT_SHAPE,
            },
          },
        }),
      ),
    ).toBe(LIVE_SESSION_CONSTRAINT.EVENT_PARTICIPANT_SHAPE);
  });

  it("does not classify conflicts from database message text", () => {
    const error = makePrismaKnownRequestError("P2002", {
      modelName: "SpeakingSessionLiveGrant",
    });

    Object.assign(error, {
      message:
        'duplicate key value violates unique constraint "ss_live_grant_join_attempt_key"',
    });

    expect(getLiveSessionConstraintIdentity(error)).toBeNull();
  });
});
