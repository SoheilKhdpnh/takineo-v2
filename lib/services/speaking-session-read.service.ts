import "server-only";

import {
  getUserAccessContext,
} from "@/lib/auth/access";
import {
  prisma,
} from "@/lib/db/prisma";
import {
  decodeSessionReadCursor,
  encodeSessionReadCursor,
  type SessionReadCursor,
} from "@/lib/domain/session-read-cursor";
import {
  buildSessionBucketWhere,
  type SessionReadBucket,
} from "@/lib/domain/session-read-policy";
import {
  SessionReadForbiddenError,
  SessionReadInvariantError,
  SessionReadTargetNotFoundError,
} from "@/lib/errors/session-read-errors";
import {
  Prisma,
} from "@/lib/generated/prisma/client";
import {
  listSpeakingSessionsSchema,
  speakingSessionReadIdSchema,
  type ListSpeakingSessionsInput,
} from "@/lib/validations/session-read";

const cancellationReadSelect = {
  actorType:
    true,

  cancelledAt:
    true,
} satisfies
  Prisma.SpeakingSessionCancellationSelect;

const studentViewerSessionSelect = {
  id:
    true,

  startAt:
    true,

  endAt:
    true,

  status:
    true,

  teacherProfile: {
    select: {
      id:
        true,

      userId:
        true,

      headline:
        true,

      user: {
        select: {
          id:
            true,

          name:
            true,

          image:
            true,
        },
      },
    },
  },

  cancellation: {
    select:
      cancellationReadSelect,
  },
} satisfies
  Prisma.SpeakingSessionSelect;

const teacherViewerSessionSelect = {
  id:
    true,

  startAt:
    true,

  endAt:
    true,

  status:
    true,

  studentUser: {
    select: {
      id:
        true,

      name:
        true,

      image:
        true,
    },
  },

  cancellation: {
    select:
      cancellationReadSelect,
  },
} satisfies
  Prisma.SpeakingSessionSelect;

type StudentViewerSessionRow =
  Prisma.SpeakingSessionGetPayload<{
    select:
      typeof studentViewerSessionSelect;
  }>;

type TeacherViewerSessionRow =
  Prisma.SpeakingSessionGetPayload<{
    select:
      typeof teacherViewerSessionSelect;
  }>;

type SessionCancellationView = {
  actorType:
    "STUDENT" |
    "TEACHER" |
    "ADMIN" |
    "SYSTEM";

  cancelledAt:
    Date;
};

export type SpeakingSessionCounterparty =
  | {
      type:
        "TEACHER";

      userId:
        string;

      teacherProfileId:
        string;

      name:
        string;

      image:
        string | null;

      headline:
        string | null;
    }
  | {
      type:
        "STUDENT";

      userId:
        string;

      name:
        string;

      image:
        string | null;
    };

export type SpeakingSessionView = {
  id:
    string;

  startAt:
    Date;

  endAt:
    Date;

  status:
    "SCHEDULED" |
    "COMPLETED" |
    "CANCELLED";

  counterparty:
    SpeakingSessionCounterparty;

  cancellation:
    SessionCancellationView | null;
};

export type SpeakingSessionListResult = {
  items:
    SpeakingSessionView[];

  hasMore:
    boolean;

  nextCursor:
    string | null;
};

type SessionViewer =
  | {
      type:
        "STUDENT";

      userId:
        string;
    }
  | {
      type:
        "TEACHER";

      userId:
        string;

      teacherProfileId:
        string;
    };

function assertValidNow(
  now: Date,
): void {
  if (
    Number.isNaN(
      now.getTime(),
    )
  ) {
    throw new RangeError(
      "Session read now must be a valid Date.",
    );
  }
}

async function resolveSessionViewer(
  userId: string,
): Promise<SessionViewer> {
  const access =
    await getUserAccessContext(
      userId,
    );

  if (
    !access ||
    access.accountStatus !==
      "ACTIVE"
  ) {
    throw new SessionReadForbiddenError();
  }

  if (
    access.role ===
    "STUDENT"
  ) {
    if (
      !access.studentProfile
    ) {
      throw new SessionReadInvariantError(
        "A STUDENT role exists without a StudentProfile.",
      );
    }

    return {
      type:
        "STUDENT",

      userId:
        access.id,
    };
  }

  if (
    access.role ===
    "TEACHER"
  ) {
    if (
      !access.teacherProfile
    ) {
      throw new SessionReadInvariantError(
        "A TEACHER role exists without a TeacherProfile.",
      );
    }

    return {
      type:
        "TEACHER",

      userId:
        access.id,

      teacherProfileId:
        access.teacherProfile.id,
    };
  }

  throw new SessionReadForbiddenError();
}

function buildViewerScopeWhere(
  viewer:
    SessionViewer,
): Prisma.SpeakingSessionWhereInput {
  if (
    viewer.type ===
    "STUDENT"
  ) {
    return {
      studentUserId:
        viewer.userId,
    };
  }

  return {
    teacherProfileId:
      viewer.teacherProfileId,
  };
}

function buildSessionKeysetWhere(
  bucket:
    SessionReadBucket,
  cursor:
    SessionReadCursor,
): Prisma.SpeakingSessionWhereInput {
  if (
    bucket ===
    "upcoming"
  ) {
    return {
      OR: [
        {
          startAt: {
            gt:
              cursor.startAt,
          },
        },
        {
          startAt:
            cursor.startAt,

          id: {
            gt:
              cursor.id,
          },
        },
      ],
    };
  }

  return {
    OR: [
      {
        startAt: {
          lt:
            cursor.startAt,
        },
      },
      {
        startAt:
          cursor.startAt,

        id: {
          lt:
            cursor.id,
        },
      },
    ],
  };
}

function getSessionReadOrderBy(
  bucket:
    SessionReadBucket,
):
  Prisma.SpeakingSessionOrderByWithRelationInput[] {
  if (
    bucket ===
    "upcoming"
  ) {
    return [
      {
        startAt:
          "asc",
      },
      {
        id:
          "asc",
      },
    ];
  }

  return [
    {
      startAt:
        "desc",
    },
    {
      id:
        "desc",
    },
  ];
}

function serializeCancellation(
  status:
    "SCHEDULED" |
    "COMPLETED" |
    "CANCELLED",
  cancellation: {
    actorType:
      "STUDENT" |
      "TEACHER" |
      "ADMIN" |
      "SYSTEM";

    cancelledAt:
      Date;
  } | null,
): SessionCancellationView | null {
  if (
    status ===
      "CANCELLED" &&
    !cancellation
  ) {
    throw new SessionReadInvariantError(
      "A CANCELLED speaking session has no cancellation history.",
    );
  }

  if (
    status !==
      "CANCELLED" &&
    cancellation
  ) {
    throw new SessionReadInvariantError(
      "A non-cancelled speaking session has cancellation history.",
    );
  }

  if (
    !cancellation
  ) {
    return null;
  }

  return {
    actorType:
      cancellation.actorType,

    cancelledAt:
      cancellation.cancelledAt,
  };
}

function serializeStudentViewerSession(
  row:
    StudentViewerSessionRow,
): SpeakingSessionView {
  return {
    id:
      row.id,

    startAt:
      row.startAt,

    endAt:
      row.endAt,

    status:
      row.status,

    counterparty: {
      type:
        "TEACHER",

      userId:
        row.teacherProfile.user.id,

      teacherProfileId:
        row.teacherProfile.id,

      name:
        row.teacherProfile.user.name,

      image:
        row.teacherProfile.user.image,

      headline:
        row.teacherProfile.headline,
    },

    cancellation:
      serializeCancellation(
        row.status,
        row.cancellation,
      ),
  };
}

function serializeTeacherViewerSession(
  row:
    TeacherViewerSessionRow,
): SpeakingSessionView {
  return {
    id:
      row.id,

    startAt:
      row.startAt,

    endAt:
      row.endAt,

    status:
      row.status,

    counterparty: {
      type:
        "STUDENT",

      userId:
        row.studentUser.id,

      name:
        row.studentUser.name,

      image:
        row.studentUser.image,
    },

    cancellation:
      serializeCancellation(
        row.status,
        row.cancellation,
      ),
  };
}

function finalizePage<
  TRow extends {
    id:
      string;

    startAt:
      Date;
  },
>(
  rows:
    TRow[],
  limit:
    number,
  bucket:
    SessionReadBucket,
  asOf:
    Date,
  serialize:
    (
      row: TRow,
    ) => SpeakingSessionView,
): SpeakingSessionListResult {
  const hasMore =
    rows.length >
      limit;

  const pageRows =
    hasMore
      ? rows.slice(
          0,
          limit,
        )
      : rows;

  const items =
    pageRows.map(
      serialize,
    );

  const lastRow =
    pageRows.at(
      -1,
    );

  return {
    items,

    hasMore,

    nextCursor:
      hasMore &&
      lastRow
        ? encodeSessionReadCursor({
            bucket,

            asOf,

            startAt:
              lastRow.startAt,

            id:
              lastRow.id,
          })
        : null,
  };
}

export async function listSpeakingSessions(
  userId: string,
  input:
    ListSpeakingSessionsInput,
  options: {
    now?:
      Date;
  } = {},
): Promise<SpeakingSessionListResult> {
  const parsed =
    listSpeakingSessionsSchema.parse(
      input,
    );

  const viewer =
    await resolveSessionViewer(
      userId,
    );

  const cursor =
    parsed.cursor
      ? decodeSessionReadCursor(
          parsed.cursor,
          parsed.bucket,
        )
      : null;

  const currentNow =
    options.now ??
    new Date();

  assertValidNow(
    currentNow,
  );

  /*
   * A cursor pins the temporal boundary from
   * page one. It does not provide a historical
   * snapshot of mutable session status.
   */
  const asOf =
    cursor?.asOf ??
    currentNow;

  const whereParts:
    Prisma.SpeakingSessionWhereInput[] = [
      buildViewerScopeWhere(
        viewer,
      ),

      buildSessionBucketWhere(
        parsed.bucket,
        asOf,
      ),
    ];

  if (
    cursor
  ) {
    whereParts.push(
      buildSessionKeysetWhere(
        parsed.bucket,
        cursor,
      ),
    );
  }

  const where:
    Prisma.SpeakingSessionWhereInput = {
      AND:
        whereParts,
    };

  const orderBy =
    getSessionReadOrderBy(
      parsed.bucket,
    );

  if (
    viewer.type ===
    "STUDENT"
  ) {
    const rows =
      await prisma
        .speakingSession
        .findMany({
          where,

          orderBy,

          take:
            parsed.limit +
            1,

          select:
            studentViewerSessionSelect,
        });

    return finalizePage(
      rows,
      parsed.limit,
      parsed.bucket,
      asOf,
      serializeStudentViewerSession,
    );
  }

  const rows =
    await prisma
      .speakingSession
      .findMany({
        where,

        orderBy,

        take:
          parsed.limit +
          1,

        select:
          teacherViewerSessionSelect,
      });

  return finalizePage(
    rows,
    parsed.limit,
    parsed.bucket,
    asOf,
    serializeTeacherViewerSession,
  );
}

export async function getSpeakingSessionForViewer(
  userId: string,
  sessionId: string,
): Promise<SpeakingSessionView> {
  const parsedSessionId =
    speakingSessionReadIdSchema.parse(
      sessionId,
    );

  const viewer =
    await resolveSessionViewer(
      userId,
    );

  const scope =
    buildViewerScopeWhere(
      viewer,
    );

  if (
    viewer.type ===
    "STUDENT"
  ) {
    const row =
      await prisma
        .speakingSession
        .findFirst({
          where: {
            id:
              parsedSessionId,

            ...scope,
          },

          select:
            studentViewerSessionSelect,
        });

    if (
      !row
    ) {
      throw new SessionReadTargetNotFoundError();
    }

    return serializeStudentViewerSession(
      row,
    );
  }

  const row =
    await prisma
      .speakingSession
      .findFirst({
        where: {
          id:
            parsedSessionId,

          ...scope,
        },

        select:
          teacherViewerSessionSelect,
      });

  if (
    !row
  ) {
    /*
     * Deliberately indistinguishable from a
     * genuinely nonexistent session.
     */
    throw new SessionReadTargetNotFoundError();
  }

  return serializeTeacherViewerSession(
    row,
  );
}
