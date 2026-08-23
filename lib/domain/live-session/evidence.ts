import {
  createLiveSessionEvidenceTimingPolicy,
  type LiveSessionEvidenceTimingPolicy,
  type LiveSessionParticipantRole,
} from "@/lib/domain/live-session/policy";
import type {
  LiveSessionCredentialGrant,
  LiveSessionParticipantPresenceEvent,
  LiveSessionProviderEvidenceEvent,
} from "@/lib/domain/live-session/provider";

export type LiveSessionEvidenceQuality =
  | "COMPLETE"
  | "OPEN_AT_HORIZON"
  | "ORPHANED_DISCONNECT"
  | "INVALID_SEQUENCE";

export type LiveSessionPresenceIntervalEndReason =
  | "PARTICIPANT_DISCONNECTED"
  | "ROOM_ENDED"
  | "ANALYTICAL_HORIZON";

export type LiveSessionEvidenceSessionSnapshot =
  Readonly<{
    id:
      string;

    startAt:
      Date;

    endAt:
      Date;
  }>;

export type LiveSessionParticipantPresenceInterval =
  Readonly<{
    providerParticipantRef:
      string;

    connectionRef:
      string;

    startedAt:
      Date;

    endedAt:
      Date;

    intervalEndReason:
      LiveSessionPresenceIntervalEndReason;

    evidenceQuality:
      "COMPLETE" |
      "OPEN_AT_HORIZON";
  }>;

export type LiveSessionParticipantEvidence =
  Readonly<{
    participantUserId:
      string;

    participantRole:
      LiveSessionParticipantRole;

    presenceMs:
      number;

    reconnectCount:
      number;

    evidenceQuality:
      LiveSessionEvidenceQuality;

    invalidSequenceCount:
      number;

    orphanDisconnectCount:
      number;

    openConnectionCount:
      number;

    intervals:
      readonly LiveSessionParticipantPresenceInterval[];
  }>;

export type LiveSessionEvidenceReduction =
  Readonly<{
    sessionId:
      string;

    asOf:
      Date;

    analyticalHorizonAt:
      Date;

    liveEvidenceHorizonAt:
      Date;

    roomEndedAt:
      Date | null;

    conflictingProviderEventRefCount:
      number;

    unattributedParticipantEventCount:
      number;

    participants:
      readonly LiveSessionParticipantEvidence[];
  }>;

type ParticipantBuilder = {
  participantUserId:
    string;

  participantRole:
    LiveSessionParticipantRole;

  invalidSequenceCount:
    number;

  orphanDisconnectCount:
    number;

  openConnectionCount:
    number;

  intervals:
    LiveSessionParticipantPresenceInterval[];
};

type ConnectionEvidenceGroup = {
  grant:
    LiveSessionCredentialGrant;

  connectionRef:
    string;

  events:
    LiveSessionParticipantPresenceEvent[];
};

type DeduplicatedProviderEvent = {
  event:
    LiveSessionProviderEvidenceEvent;

  signature:
    string;

  conflicting:
    boolean;
};

function assertNonEmptyString(
  value:
    string,
  label:
    string,
): void {
  if (
    value.length === 0
  ) {
    throw new RangeError(
      `${label} must not be empty.`,
    );
  }
}

function assertValidDate(
  value:
    Date,
  label:
    string,
): void {
  if (
    !(value instanceof Date) ||
    Number.isNaN(
      value.getTime(),
    )
  ) {
    throw new RangeError(
      `${label} must be a valid Date.`,
    );
  }
}

function cloneDate(
  valueMs:
    number,
): Date {
  return new Date(
    valueMs,
  );
}

function addMilliseconds(
  valueMs:
    number,
  deltaMs:
    number,
  label:
    string,
): number {
  const result =
    valueMs + deltaMs;

  if (
    !Number.isSafeInteger(
      result,
    ) ||
    Number.isNaN(
      new Date(
        result,
      ).getTime(),
    )
  ) {
    throw new RangeError(
      `${label} is outside the supported Date range.`,
    );
  }

  return result;
}

function participantKey(
  role:
    LiveSessionParticipantRole,
  userId:
    string,
): string {
  return JSON.stringify([
    role,
    userId,
  ]);
}

function connectionKey(
  providerParticipantRef:
    string,
  connectionRef:
    string,
): string {
  return JSON.stringify([
    providerParticipantRef,
    connectionRef,
  ]);
}

function compareStrings(
  left:
    string,
  right:
    string,
): number {
  if (
    left < right
  ) {
    return -1;
  }

  if (
    left > right
  ) {
    return 1;
  }

  return 0;
}

function eventTypeOrder(
  event:
    LiveSessionProviderEvidenceEvent,
): number {
  if (
    event.type ===
    "PARTICIPANT_CONNECTED"
  ) {
    return 0;
  }

  if (
    event.type ===
    "PARTICIPANT_DISCONNECTED"
  ) {
    return 1;
  }

  return 2;
}

function compareProviderEvents(
  left:
    LiveSessionProviderEvidenceEvent,
  right:
    LiveSessionProviderEvidenceEvent,
): number {
  const timeDifference =
    left.occurredAt.getTime() -
    right.occurredAt.getTime();

  if (
    timeDifference !== 0
  ) {
    return timeDifference;
  }

  const typeDifference =
    eventTypeOrder(
      left,
    ) -
    eventTypeOrder(
      right,
    );

  if (
    typeDifference !== 0
  ) {
    return typeDifference;
  }

  return compareStrings(
    left.providerEventRef,
    right.providerEventRef,
  );
}

function eventSignature(
  event:
    LiveSessionProviderEvidenceEvent,
): string {
  if (
    event.type ===
    "ROOM_ENDED"
  ) {
    return JSON.stringify([
      event.type,
      event.sessionId,
      event.occurredAt.getTime(),
    ]);
  }

  return JSON.stringify([
    event.type,
    event.sessionId,
    event.occurredAt.getTime(),
    event.providerParticipantRef,
    event.connectionRef,
  ]);
}

function determineBoundEndReason(
  liveEvidenceHorizonMs:
    number,
  roomEndedAtMs:
    number | null,
): "ROOM_ENDED" |
  "ANALYTICAL_HORIZON" {
  if (
    roomEndedAtMs !== null &&
    roomEndedAtMs ===
      liveEvidenceHorizonMs
  ) {
    return "ROOM_ENDED";
  }

  return "ANALYTICAL_HORIZON";
}

function appendValidConnectionInterval(
  builder:
    ParticipantBuilder,
  connectedEvent:
    LiveSessionParticipantPresenceEvent & {
      type:
        "PARTICIPANT_CONNECTED";
    },
  disconnectedEvent:
    (LiveSessionParticipantPresenceEvent & {
      type:
        "PARTICIPANT_DISCONNECTED";
    }) |
    null,
  analysisStartsAtMs:
    number,
  liveEvidenceHorizonMs:
    number,
  roomEndedAtMs:
    number | null,
): void {
  const intervalStartMs =
    Math.max(
      connectedEvent.occurredAt.getTime(),
      analysisStartsAtMs,
    );

  const disconnectedAtMs =
    disconnectedEvent?.occurredAt.getTime() ??
    null;

  const intervalEndMs =
    disconnectedAtMs === null
      ? liveEvidenceHorizonMs
      : Math.min(
          disconnectedAtMs,
          liveEvidenceHorizonMs,
        );

  if (
    intervalEndMs <=
    intervalStartMs
  ) {
    return;
  }

  let intervalEndReason:
    LiveSessionPresenceIntervalEndReason;

  if (
    disconnectedAtMs !== null &&
    disconnectedAtMs <=
      liveEvidenceHorizonMs
  ) {
    intervalEndReason =
      "PARTICIPANT_DISCONNECTED";
  }
  else {
    intervalEndReason =
      determineBoundEndReason(
        liveEvidenceHorizonMs,
        roomEndedAtMs,
      );
  }

  builder.intervals.push({
    providerParticipantRef:
      connectedEvent.providerParticipantRef,

    connectionRef:
      connectedEvent.connectionRef,

    startedAt:
      cloneDate(
        intervalStartMs,
      ),

    endedAt:
      cloneDate(
        intervalEndMs,
      ),

    intervalEndReason,

    evidenceQuality:
      disconnectedEvent === null
        ? "OPEN_AT_HORIZON"
        : "COMPLETE",
  });
}

function summarizePresence(
  intervals:
    readonly LiveSessionParticipantPresenceInterval[],
): Readonly<{
  presenceMs:
    number;

  reconnectCount:
    number;
}> {
  if (
    intervals.length === 0
  ) {
    return {
      presenceMs:
        0,

      reconnectCount:
        0,
    };
  }

  const ordered =
    [...intervals].sort(
      (left, right) => {
        const startDifference =
          left.startedAt.getTime() -
          right.startedAt.getTime();

        if (
          startDifference !== 0
        ) {
          return startDifference;
        }

        const endDifference =
          left.endedAt.getTime() -
          right.endedAt.getTime();

        if (
          endDifference !== 0
        ) {
          return endDifference;
        }

        const providerDifference =
          compareStrings(
            left.providerParticipantRef,
            right.providerParticipantRef,
          );

        if (
          providerDifference !== 0
        ) {
          return providerDifference;
        }

        return compareStrings(
          left.connectionRef,
          right.connectionRef,
        );
      },
    );

  let presenceMs =
    0;

  let reconnectCount =
    0;

  let unionStartMs =
    ordered[0].startedAt.getTime();

  let unionEndMs =
    ordered[0].endedAt.getTime();

  for (
    let index = 1;
    index < ordered.length;
    index += 1
  ) {
    const interval =
      ordered[index];

    const startMs =
      interval.startedAt.getTime();

    const endMs =
      interval.endedAt.getTime();

    if (
      startMs <=
      unionEndMs
    ) {
      unionEndMs =
        Math.max(
          unionEndMs,
          endMs,
        );

      continue;
    }

    presenceMs +=
      unionEndMs -
      unionStartMs;

    reconnectCount +=
      1;

    unionStartMs =
      startMs;

    unionEndMs =
      endMs;
  }

  presenceMs +=
    unionEndMs -
    unionStartMs;

  return {
    presenceMs,
    reconnectCount,
  };
}

function evidenceQualityFor(
  builder:
    ParticipantBuilder,
): LiveSessionEvidenceQuality {
  if (
    builder.invalidSequenceCount >
    0
  ) {
    return "INVALID_SEQUENCE";
  }

  if (
    builder.orphanDisconnectCount >
    0
  ) {
    return "ORPHANED_DISCONNECT";
  }

  if (
    builder.openConnectionCount >
      0 ||
    builder.intervals.some(
      (interval) =>
        interval.evidenceQuality ===
        "OPEN_AT_HORIZON",
    )
  ) {
    return "OPEN_AT_HORIZON";
  }

  return "COMPLETE";
}

export function reduceLiveSessionEvidence(
  input: Readonly<{
    session:
      LiveSessionEvidenceSessionSnapshot;

    grants:
      readonly LiveSessionCredentialGrant[];

    events:
      readonly LiveSessionProviderEvidenceEvent[];

    policy:
      LiveSessionEvidenceTimingPolicy;

    asOf:
      Date;
  }>,
): LiveSessionEvidenceReduction {
  const {
    session,
    grants,
    events,
    asOf,
  } = input;

  assertNonEmptyString(
    session.id,
    "Live-session session id",
  );

  assertValidDate(
    session.startAt,
    "Live-session startAt",
  );

  assertValidDate(
    session.endAt,
    "Live-session endAt",
  );

  assertValidDate(
    asOf,
    "Live-session evidence asOf",
  );

  if (
    session.endAt.getTime() <=
    session.startAt.getTime()
  ) {
    throw new RangeError(
      "Live-session endAt must be after startAt.",
    );
  }

  const policy =
    createLiveSessionEvidenceTimingPolicy(
      input.policy,
    );

  const analyticalHorizonMs =
    addMilliseconds(
      session.endAt.getTime(),
      policy.evidenceHorizonGraceMs,
      "Live-session analytical horizon",
    );

  const participantBuilders =
    new Map<
      string,
      ParticipantBuilder
    >();

  const participantRoleByUserId =
    new Map<
      string,
      LiveSessionParticipantRole
    >();

  const grantByProviderParticipantRef =
    new Map<
      string,
      LiveSessionCredentialGrant
    >();

  const grantIds =
    new Set<string>();

  const joinAttempts =
    new Set<string>();

  for (
    const grant of grants
  ) {
    assertNonEmptyString(
      grant.grantId,
      "Live-session grant id",
    );

    assertNonEmptyString(
      grant.clientJoinAttemptId,
      "Live-session clientJoinAttemptId",
    );

    assertNonEmptyString(
      grant.participantUserId,
      "Live-session participant user id",
    );

    assertNonEmptyString(
      grant.providerParticipantRef,
      "Live-session providerParticipantRef",
    );

    assertValidDate(
      grant.authorizedAt,
      "Live-session grant authorizedAt",
    );

    if (
      grant.sessionId !==
      session.id
    ) {
      throw new RangeError(
        "Every live-session grant must belong to the reduced session.",
      );
    }

    if (
      grantIds.has(
        grant.grantId,
      )
    ) {
      throw new RangeError(
        "Live-session grant ids must be unique.",
      );
    }

    grantIds.add(
      grant.grantId,
    );

    if (
      grantByProviderParticipantRef.has(
        grant.providerParticipantRef,
      )
    ) {
      throw new RangeError(
        "providerParticipantRef must be unique per live-session grant.",
      );
    }

    grantByProviderParticipantRef.set(
      grant.providerParticipantRef,
      grant,
    );

    const joinAttemptKey =
      JSON.stringify([
        grant.participantUserId,
        grant.clientJoinAttemptId,
      ]);

    if (
      joinAttempts.has(
        joinAttemptKey,
      )
    ) {
      throw new RangeError(
        "clientJoinAttemptId must be idempotent per participant.",
      );
    }

    joinAttempts.add(
      joinAttemptKey,
    );

    const existingRole =
      participantRoleByUserId.get(
        grant.participantUserId,
      );

    if (
      existingRole !== undefined &&
      existingRole !==
        grant.participantRole
    ) {
      throw new RangeError(
        "A live-session participant cannot have multiple roles.",
      );
    }

    participantRoleByUserId.set(
      grant.participantUserId,
      grant.participantRole,
    );

    const key =
      participantKey(
        grant.participantRole,
        grant.participantUserId,
      );

    if (
      !participantBuilders.has(
        key,
      )
    ) {
      participantBuilders.set(
        key,
        {
          participantUserId:
            grant.participantUserId,

          participantRole:
            grant.participantRole,

          invalidSequenceCount:
            0,

          orphanDisconnectCount:
            0,

          openConnectionCount:
            0,

          intervals:
            [],
        },
      );
    }
  }

  const deduplicated =
    new Map<
      string,
      DeduplicatedProviderEvent
    >();

  for (
    const event of events
  ) {
    assertNonEmptyString(
      event.providerEventRef,
      "Live-session providerEventRef",
    );

    assertValidDate(
      event.occurredAt,
      "Live-session provider event occurredAt",
    );

    if (
      event.sessionId !==
        session.id ||
      event.occurredAt.getTime() >
        asOf.getTime()
    ) {
      continue;
    }

    if (
      event.type !==
      "ROOM_ENDED"
    ) {
      assertNonEmptyString(
        event.providerParticipantRef,
        "Live-session providerParticipantRef",
      );

      assertNonEmptyString(
        event.connectionRef,
        "Live-session connectionRef",
      );
    }

    const signature =
      eventSignature(
        event,
      );

    const existing =
      deduplicated.get(
        event.providerEventRef,
      );

    if (
      existing === undefined
    ) {
      deduplicated.set(
        event.providerEventRef,
        {
          event,
          signature,
          conflicting:
            false,
        },
      );

      continue;
    }

    if (
      existing.signature !==
      signature
    ) {
      existing.conflicting =
        true;
    }
  }

  const conflictingProviderEventRefCount =
    [...deduplicated.values()].filter(
      (entry) =>
        entry.conflicting,
    ).length;

  const acceptedEvents =
    [...deduplicated.values()]
      .filter(
        (entry) =>
          !entry.conflicting,
      )
      .map(
        (entry) =>
          entry.event,
      )
      .sort(
        compareProviderEvents,
      );

  const roomEndedAtMs =
    acceptedEvents.reduce<
      number | null
    >(
      (earliest, event) => {
        if (
          event.type !==
          "ROOM_ENDED"
        ) {
          return earliest;
        }

        const occurredAtMs =
          event.occurredAt.getTime();

        if (
          earliest === null
        ) {
          return occurredAtMs;
        }

        return Math.min(
          earliest,
          occurredAtMs,
        );
      },
      null,
    );

  const liveEvidenceHorizonMs =
    Math.min(
      asOf.getTime(),
      analyticalHorizonMs,
      roomEndedAtMs ??
        Number.POSITIVE_INFINITY,
    );

  const connectionGroups =
    new Map<
      string,
      ConnectionEvidenceGroup
    >();

  let unattributedParticipantEventCount =
    0;

  for (
    const event of acceptedEvents
  ) {
    if (
      event.type ===
      "ROOM_ENDED"
    ) {
      continue;
    }

    const grant =
      grantByProviderParticipantRef.get(
        event.providerParticipantRef,
      );

    if (
      grant === undefined
    ) {
      unattributedParticipantEventCount +=
        1;

      continue;
    }

    const key =
      connectionKey(
        event.providerParticipantRef,
        event.connectionRef,
      );

    const group =
      connectionGroups.get(
        key,
      );

    if (
      group === undefined
    ) {
      connectionGroups.set(
        key,
        {
          grant,
          connectionRef:
            event.connectionRef,
          events: [
            event,
          ],
        },
      );

      continue;
    }

    group.events.push(
      event,
    );
  }

  for (
    const group of connectionGroups.values()
  ) {
    const builderKey =
      participantKey(
        group.grant.participantRole,
        group.grant.participantUserId,
      );

    const builder =
      participantBuilders.get(
        builderKey,
      );

    if (
      builder === undefined
    ) {
      throw new Error(
        "Live-session participant builder invariant failed.",
      );
    }

    const ordered =
      [...group.events].sort(
        compareProviderEvents,
      );

    const connectedEvents =
      ordered.filter(
        (
          event,
        ): event is LiveSessionParticipantPresenceEvent & {
          type:
            "PARTICIPANT_CONNECTED";
        } =>
          event.type ===
          "PARTICIPANT_CONNECTED",
      );

    const disconnectedEvents =
      ordered.filter(
        (
          event,
        ): event is LiveSessionParticipantPresenceEvent & {
          type:
            "PARTICIPANT_DISCONNECTED";
        } =>
          event.type ===
          "PARTICIPANT_DISCONNECTED",
      );

    if (
      connectedEvents.length === 0
    ) {
      builder.orphanDisconnectCount +=
        disconnectedEvents.length;

      continue;
    }

    if (
      connectedEvents.length !== 1 ||
      disconnectedEvents.length > 1
    ) {
      builder.invalidSequenceCount +=
        1;

      continue;
    }

    const connectedEvent =
      connectedEvents[0];

    const disconnectedEvent =
      disconnectedEvents[0] ??
      null;

    if (
      disconnectedEvent !== null &&
      disconnectedEvent.occurredAt.getTime() <
        connectedEvent.occurredAt.getTime()
    ) {
      builder.invalidSequenceCount +=
        1;

      continue;
    }

    if (
      disconnectedEvent === null &&
      connectedEvent.occurredAt.getTime() <
        liveEvidenceHorizonMs
    ) {
      builder.openConnectionCount +=
        1;
    }

    appendValidConnectionInterval(
      builder,
      connectedEvent,
      disconnectedEvent,
      session.startAt.getTime(),
      liveEvidenceHorizonMs,
      roomEndedAtMs,
    );
  }

  const participants =
    [...participantBuilders.values()]
      .map(
        (
          builder,
        ): LiveSessionParticipantEvidence => {
          const intervals =
            [...builder.intervals].sort(
              (left, right) => {
                const startDifference =
                  left.startedAt.getTime() -
                  right.startedAt.getTime();

                if (
                  startDifference !== 0
                ) {
                  return startDifference;
                }

                const endDifference =
                  left.endedAt.getTime() -
                  right.endedAt.getTime();

                if (
                  endDifference !== 0
                ) {
                  return endDifference;
                }

                const providerDifference =
                  compareStrings(
                    left.providerParticipantRef,
                    right.providerParticipantRef,
                  );

                if (
                  providerDifference !== 0
                ) {
                  return providerDifference;
                }

                return compareStrings(
                  left.connectionRef,
                  right.connectionRef,
                );
              },
            );

          const presence =
            summarizePresence(
              intervals,
            );

          return {
            participantUserId:
              builder.participantUserId,

            participantRole:
              builder.participantRole,

            presenceMs:
              presence.presenceMs,

            reconnectCount:
              presence.reconnectCount,

            evidenceQuality:
              evidenceQualityFor(
                builder,
              ),

            invalidSequenceCount:
              builder.invalidSequenceCount,

            orphanDisconnectCount:
              builder.orphanDisconnectCount,

            openConnectionCount:
              builder.openConnectionCount,

            intervals,
          };
        },
      )
      .sort(
        (left, right) => {
          if (
            left.participantRole !==
            right.participantRole
          ) {
            return left.participantRole ===
              "STUDENT"
              ? -1
              : 1;
          }

          return compareStrings(
            left.participantUserId,
            right.participantUserId,
          );
        },
      );

  return {
    sessionId:
      session.id,

    asOf:
      cloneDate(
        asOf.getTime(),
      ),

    analyticalHorizonAt:
      cloneDate(
        analyticalHorizonMs,
      ),

    liveEvidenceHorizonAt:
      cloneDate(
        liveEvidenceHorizonMs,
      ),

    roomEndedAt:
      roomEndedAtMs === null
        ? null
        : cloneDate(
            roomEndedAtMs,
          ),

    conflictingProviderEventRefCount,

    unattributedParticipantEventCount,

    participants,
  };
}
