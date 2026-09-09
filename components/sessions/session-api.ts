export type SessionViewerRole =
  | "STUDENT"
  | "TEACHER";

export type SessionCounterparty =
  | {
      type: "TEACHER";
      userId: string;
      teacherProfileId: string;
      name: string;
      image: string | null;
      headline: string | null;
    }
  | {
      type: "STUDENT";
      userId: string;
      name: string;
      image: string | null;
    };

export type SessionCancellation = {
  actorType:
    | "STUDENT"
    | "TEACHER"
    | "ADMIN"
    | "SYSTEM";
  cancelledAt: string;
};

export type SessionListItem = {
  id: string;
  startAt: string;
  endAt: string;
  status:
    | "SCHEDULED"
    | "COMPLETED"
    | "CANCELLED";
  counterparty: SessionCounterparty;
  cancellation: SessionCancellation | null;
};

export type SessionListResponse = {
  items: SessionListItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type SessionApiErrorBody = {
  error?: string;
  state?: string;
};

export type SessionCancellationSuccess = {
  session: {
    id: string;
    status: "CANCELLED";
  };
  cancellation: {
    sessionId: string;
    actorType:
      | "STUDENT"
      | "TEACHER"
      | "ADMIN"
      | "SYSTEM";
    cancelledAt: string;
  };
  alreadyCancelled: boolean;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function isIsoInstant(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    !Number.isNaN(
      Date.parse(value),
    )
  );
}

function isNullableString(
  value: unknown,
): value is string | null {
  return (
    typeof value === "string" ||
    value === null
  );
}

function isCounterparty(
  value: unknown,
): value is SessionCounterparty {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.type === "TEACHER"
  ) {
    return (
      typeof value.userId === "string" &&
      typeof value.teacherProfileId === "string" &&
      typeof value.name === "string" &&
      isNullableString(value.image) &&
      isNullableString(value.headline)
    );
  }

  if (
    value.type === "STUDENT"
  ) {
    return (
      typeof value.userId === "string" &&
      typeof value.name === "string" &&
      isNullableString(value.image)
    );
  }

  return false;
}

function isCancellation(
  value: unknown,
): value is SessionCancellation {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (
      value.actorType === "STUDENT" ||
      value.actorType === "TEACHER" ||
      value.actorType === "ADMIN" ||
      value.actorType === "SYSTEM"
    ) &&
    isIsoInstant(value.cancelledAt)
  );
}

function isSessionListItem(
  value: unknown,
): value is SessionListItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    isIsoInstant(value.startAt) &&
    isIsoInstant(value.endAt) &&
    (
      value.status === "SCHEDULED" ||
      value.status === "COMPLETED" ||
      value.status === "CANCELLED"
    ) &&
    isCounterparty(value.counterparty) &&
    (
      value.cancellation === null ||
      isCancellation(value.cancellation)
    )
  );
}

export function parseSessionListResponse(
  value: unknown,
): SessionListResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const nextCursor =
    typeof value.nextCursor === "string"
      ? value.nextCursor
      : value.nextCursor === null
        ? null
        : undefined;

  if (
    !Array.isArray(value.items) ||
    !value.items.every(isSessionListItem) ||
    typeof value.hasMore !== "boolean" ||
    nextCursor === undefined ||
    (
      value.hasMore &&
      (
        nextCursor === null ||
        nextCursor.length === 0
      )
    )
  ) {
    return null;
  }

  return {
    items: value.items,
    hasMore: value.hasMore,
    nextCursor,
  };
}

export function parseSessionApiError(
  value: unknown,
): SessionApiErrorBody {
  if (!isRecord(value)) {
    return {};
  }

  return {
    error:
      typeof value.error === "string"
        ? value.error
        : undefined,
    state:
      typeof value.state === "string"
        ? value.state
        : undefined,
  };
}

export function parseSessionCancellationSuccess(
  value: unknown,
): SessionCancellationSuccess | null {
  if (!isRecord(value)) {
    return null;
  }

  const session = value.session;
  const cancellation = value.cancellation;

  if (
    !isRecord(session) ||
    typeof session.id !== "string" ||
    session.status !== "CANCELLED" ||
    !isRecord(cancellation) ||
    typeof cancellation.sessionId !== "string" ||
    !(
      cancellation.actorType === "STUDENT" ||
      cancellation.actorType === "TEACHER" ||
      cancellation.actorType === "ADMIN" ||
      cancellation.actorType === "SYSTEM"
    ) ||
    !isIsoInstant(cancellation.cancelledAt) ||
    typeof value.alreadyCancelled !== "boolean"
  ) {
    return null;
  }

  return {
    session: {
      id: session.id,
      status: "CANCELLED",
    },
    cancellation: {
      sessionId: cancellation.sessionId,
      actorType: cancellation.actorType,
      cancelledAt: cancellation.cancelledAt,
    },
    alreadyCancelled: value.alreadyCancelled,
  };
}
