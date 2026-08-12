import "server-only";

import {
  adminPermissionHasCapability,
} from "@/lib/auth/admin-access";

import {
  BOOKING_STUDENT_CANCELLATION_CUTOFF_MINUTES,
} from "@/lib/domain/booking-policy";
import {
  SessionCancellationConflictError,
  SessionCancellationCutoffError,
  SessionCancellationForbiddenError,
  SessionCancellationInvariantError,
  SessionCancellationStateError,
  SessionCancellationTargetNotFoundError,
} from "@/lib/errors/session-cancellation-errors";
import {
  Prisma,
} from "@/lib/generated/prisma/client";
import {
  lockSpeakingSessionScope,
} from "@/lib/services/booking-locks";
import {
  runSerializableTransaction,
} from "@/lib/services/serializable-transaction";
import {
  cancelSessionAsAdminSchema,
  cancelSessionAsStudentSchema,
  cancelSessionAsTeacherSchema,
  type CancelSessionAsAdminInput,
  type CancelSessionAsStudentInput,
  type CancelSessionAsTeacherInput,
} from "@/lib/validations/session-cancellation";

type HumanCancellationActor =
  | "STUDENT"
  | "TEACHER"
  | "ADMIN";

type CancellationCommand = {
  actorType:
    HumanCancellationActor;

  actorUserId:
    string;

  sessionId:
    string;

  reason:
    string | null;
};

const cancellationSelect = {
  id: true,
  sessionId: true,
  actorType: true,
  actorUserId: true,
  reason: true,
  cancelledAt: true,
  createdAt: true,
} as const;

const sessionSelect = {
  id: true,
  teacherProfileId: true,
  studentUserId: true,
  startAt: true,
  endAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,

  teacherProfile: {
    select: {
      userId: true,
    },
  },

  cancellation: {
    select:
      cancellationSelect,
  },
} as const;

type CancellationSession =
  Prisma.SpeakingSessionGetPayload<{
    select:
      typeof sessionSelect;
  }>;

type CancellationHistory =
  Prisma.SpeakingSessionCancellationGetPayload<{
    select:
      typeof cancellationSelect;
  }>;

export type SessionCancellationResult = {
  session: {
    id: string;

    teacherProfileId:
      string;

    studentUserId:
      string;

    startAt:
      Date;

    endAt:
      Date;

    status:
      "CANCELLED";

    createdAt:
      Date;

    updatedAt:
      Date;
  };

  cancellation: {
    id: string;

    sessionId:
      string;

    actorType:
      | "STUDENT"
      | "TEACHER"
      | "ADMIN"
      | "SYSTEM";

    actorUserId:
      string | null;

    reason:
      string | null;

    cancelledAt:
      Date;

    createdAt:
      Date;
  };

  alreadyCancelled:
    boolean;
};

type TransitionRow = {
  id: string;

  teacherProfileId:
    string;

  studentUserId:
    string;

  startAt:
    Date;

  endAt:
    Date;

  createdAt:
    Date;

  updatedAt:
    Date;

  cancelledAt:
    Date;
};

type CurrentStateRow = {
  status:
    | "SCHEDULED"
    | "COMPLETED"
    | "CANCELLED";

  startAt:
    Date;

  databaseNow:
    Date;
};

function resultFromExistingCancellation(
  session:
    CancellationSession,
  cancellation:
    CancellationHistory,
): SessionCancellationResult {
  if (
    session.status !==
    "CANCELLED"
  ) {
    throw new SessionCancellationInvariantError();
  }

  return {
    session: {
      id:
        session.id,

      teacherProfileId:
        session.teacherProfileId,

      studentUserId:
        session.studentUserId,

      startAt:
        session.startAt,

      endAt:
        session.endAt,

      status:
        "CANCELLED",

      createdAt:
        session.createdAt,

      updatedAt:
        session.updatedAt,
    },

    cancellation,

    alreadyCancelled:
      true,
  };
}

async function assertActorAuthorization(
  tx:
    Prisma.TransactionClient,
  command:
    CancellationCommand,
  session:
    CancellationSession,
): Promise<void> {
  const actor =
    await tx.user.findUnique({
      where: {
        id:
          command.actorUserId,
      },

      select: {
        role: true,
        accountStatus: true,

        adminAccess: {
          select: {
            permission: true,
            revokedAt: true,
          },
        },
      },
    });

  if (
    !actor ||
    actor.accountStatus !==
      "ACTIVE"
  ) {
    throw new SessionCancellationForbiddenError();
  }

  switch (
    command.actorType
  ) {
    case "STUDENT": {
      if (
        actor.role !==
        "STUDENT"
      ) {
        throw new SessionCancellationForbiddenError();
      }

      if (
        session.studentUserId !==
        command.actorUserId
      ) {
        /*
         * Do not reveal another student's
         * session existence.
         */
        throw new SessionCancellationTargetNotFoundError();
      }

      return;
    }

    case "TEACHER": {
      if (
        actor.role !==
        "TEACHER"
      ) {
        throw new SessionCancellationForbiddenError();
      }

      /*
       * Public teacher eligibility is
       * intentionally NOT required here.
       *
       * Existing sessions survive later
       * availability/application-state
       * changes. A still-active teacher
       * must remain able to unwind an
       * existing session.
       */
      if (
        session.teacherProfile.userId !==
        command.actorUserId
      ) {
        throw new SessionCancellationTargetNotFoundError();
      }

      return;
    }

    case "ADMIN": {
      const access =
        actor.adminAccess;

      if (
        !access ||
        access.revokedAt ||
        !adminPermissionHasCapability(
          access.permission,
          "MANAGE_SESSIONS",
        )
      ) {
        throw new SessionCancellationForbiddenError();
      }

      return;
    }
  }
}

async function classifyFailedTransition(
  tx:
    Prisma.TransactionClient,
  command:
    CancellationCommand,
): Promise<SessionCancellationResult> {
  const current =
    await tx.speakingSession.findUnique({
      where: {
        id:
          command.sessionId,
      },

      select:
        sessionSelect,
    });

  if (
    !current
  ) {
    throw new SessionCancellationTargetNotFoundError();
  }

  /*
   * Authorization is deliberately repeated
   * against the latest row before returning
   * any state information.
   */
  await assertActorAuthorization(
    tx,
    command,
    current,
  );

  if (
    current.status ===
    "CANCELLED"
  ) {
    if (
      !current.cancellation
    ) {
      throw new SessionCancellationInvariantError();
    }

    return resultFromExistingCancellation(
      current,
      current.cancellation,
    );
  }

  if (
    current.cancellation
  ) {
    /*
     * History exists while the session does
     * not say CANCELLED. Never silently repair
     * this state.
     */
    throw new SessionCancellationInvariantError();
  }

  if (
    current.status ===
    "COMPLETED"
  ) {
    throw new SessionCancellationStateError(
      "COMPLETED",
    );
  }

  const rows =
    await tx.$queryRaw<
      CurrentStateRow[]
    >(Prisma.sql`
      SELECT
        "status",
        "startAt",
        clock_timestamp()
          AS "databaseNow"
      FROM
        "speaking_session"
      WHERE
        "id" =
          ${command.sessionId}
    `);

  const state =
    rows[0];

  if (
    !state
  ) {
    throw new SessionCancellationTargetNotFoundError();
  }

  if (
    state.status !==
    "SCHEDULED"
  ) {
    throw new SessionCancellationConflictError();
  }

  if (
    state.startAt.getTime() <=
    state.databaseNow.getTime()
  ) {
    throw new SessionCancellationStateError(
      "STARTED",
    );
  }

  if (
    command.actorType ===
    "STUDENT"
  ) {
    const cutoffAt =
      state.databaseNow.getTime() +
      BOOKING_STUDENT_CANCELLATION_CUTOFF_MINUTES *
        60_000;

    if (
      state.startAt.getTime() <
      cutoffAt
    ) {
      throw new SessionCancellationCutoffError();
    }
  }

  /*
   * The row was still SCHEDULED and its time
   * policy still permitted cancellation, yet
   * the compare-and-set did not succeed.
   *
   * Treat this as an actual state/concurrency
   * conflict rather than guessing.
   */
  throw new SessionCancellationConflictError();
}

async function cancelSession(
  command:
    CancellationCommand,
): Promise<SessionCancellationResult> {
  return runSerializableTransaction<SessionCancellationResult>(
    async (
      tx,
    ) => {
      /*
       * This is intentionally the FIRST
       * database operation in the transaction.
       *
       * Future completion/dispute transitions
       * must use this same session lock.
       */
      await lockSpeakingSessionScope(
        tx,
        command.sessionId,
      );

      const session =
        await tx.speakingSession.findUnique({
          where: {
            id:
              command.sessionId,
          },

          select:
            sessionSelect,
        });

      if (
        !session
      ) {
        throw new SessionCancellationTargetNotFoundError();
      }

      await assertActorAuthorization(
        tx,
        command,
        session,
      );

      /*
       * Idempotency is evaluated only AFTER
       * authorization so an unrelated caller
       * cannot probe whether a session was
       * cancelled.
       */
      if (
        session.status ===
        "CANCELLED"
      ) {
        if (
          !session.cancellation
        ) {
          throw new SessionCancellationInvariantError();
        }

        return resultFromExistingCancellation(
          session,
          session.cancellation,
        );
      }

      if (
        session.cancellation
      ) {
        throw new SessionCancellationInvariantError();
      }

      if (
        session.status ===
        "COMPLETED"
      ) {
        throw new SessionCancellationStateError(
          "COMPLETED",
        );
      }

      /*
       * DB-clock compare-and-set.
       *
       * The exact timestamp used to decide
       * eligibility is also returned and then
       * stored as cancellation.cancelledAt.
       *
       * This removes the TOCTOU gap between
       * checking the cutoff and changing state.
       */
      const timingPredicate =
        command.actorType ===
        "STUDENT"
            ? Prisma.sql`
                s."startAt" >=
                cancellation_clock."cancelledAt"
                +
                (
                    ${BOOKING_STUDENT_CANCELLATION_CUTOFF_MINUTES}
                    *
                    INTERVAL '1 minute'
                )
            `
          : Prisma.sql`
              s."startAt" >
                cancellation_clock."cancelledAt"
            `;

      const transitionedRows =
        await tx.$queryRaw<
          TransitionRow[]
        >(Prisma.sql`
          WITH
            cancellation_clock
              AS (
                SELECT
                  clock_timestamp()
                    AS "cancelledAt"
              ),

            transitioned
              AS (
                UPDATE
                  "speaking_session"
                    AS s
                SET
                  "status" =
                    'CANCELLED',
                  "updatedAt" =
                    cancellation_clock."cancelledAt"
                FROM
                  cancellation_clock
                WHERE
                  s."id" =
                    ${command.sessionId}
                  AND
                  s."status" =
                    'SCHEDULED'
                  AND
                    ${timingPredicate}
                RETURNING
                  s."id",
                  s."teacherProfileId",
                  s."studentUserId",
                  s."startAt",
                  s."endAt",
                  s."createdAt",
                  s."updatedAt"
              )

          SELECT
            transitioned."id",
            transitioned."teacherProfileId",
            transitioned."studentUserId",
            transitioned."startAt",
            transitioned."endAt",
            transitioned."createdAt",
            transitioned."updatedAt",
            cancellation_clock."cancelledAt"
              AS "cancelledAt"
          FROM
            transitioned
          CROSS JOIN
            cancellation_clock
        `);

      const transitioned =
        transitionedRows[0];

      if (
        !transitioned
      ) {
        return classifyFailedTransition(
          tx,
          command,
        );
      }

      const cancellation =
        await tx
          .speakingSessionCancellation
          .create({
            data: {
              sessionId:
                transitioned.id,

              actorType:
                command.actorType,

              actorUserId:
                command.actorUserId,

              reason:
                command.reason,

              cancelledAt:
                transitioned.cancelledAt,
            },

            select:
              cancellationSelect,
          });

      return {
        session: {
          id:
            transitioned.id,

          teacherProfileId:
            transitioned.teacherProfileId,

          studentUserId:
            transitioned.studentUserId,

          startAt:
            transitioned.startAt,

          endAt:
            transitioned.endAt,

          status:
            "CANCELLED",

          createdAt:
            transitioned.createdAt,

          updatedAt:
            transitioned.updatedAt,
        },

        cancellation,

        alreadyCancelled:
          false,
      };
    },
    {
      maxAttempts:
        3,

      conflictErrorFactory:
        () =>
          new SessionCancellationConflictError(),
    },
  ).catch(
    (
      error,
    ) => {
      if (
        error instanceof
          SessionCancellationTargetNotFoundError ||
        error instanceof
          SessionCancellationForbiddenError ||
        error instanceof
          SessionCancellationCutoffError ||
        error instanceof
          SessionCancellationStateError ||
        error instanceof
          SessionCancellationInvariantError ||
        error instanceof
          SessionCancellationConflictError
      ) {
        throw error;
      }

      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code ===
          "P2002"
      ) {
        /*
         * Proper service-to-service cancellation
         * calls share the session advisory lock,
         * so a history uniqueness collision
         * should be exceptional.
         */
        throw new SessionCancellationConflictError();
      }

      throw error;
    },
  );
}

export async function cancelSpeakingSessionAsStudent(
  actorUserId:
    string,
  input:
    CancelSessionAsStudentInput,
): Promise<SessionCancellationResult> {
  const parsed =
    cancelSessionAsStudentSchema.parse(
      input,
    );

  return cancelSession({
    actorType:
      "STUDENT",

    actorUserId,

    sessionId:
      parsed.sessionId,

    reason:
      parsed.reason ??
      null,
  });
}

export async function cancelSpeakingSessionAsTeacher(
  actorUserId:
    string,
  input:
    CancelSessionAsTeacherInput,
): Promise<SessionCancellationResult> {
  const parsed =
    cancelSessionAsTeacherSchema.parse(
      input,
    );

  return cancelSession({
    actorType:
      "TEACHER",

    actorUserId,

    sessionId:
      parsed.sessionId,

    reason:
      parsed.reason,
  });
}

export async function cancelSpeakingSessionAsAdmin(
  actorUserId:
    string,
  input:
    CancelSessionAsAdminInput,
): Promise<SessionCancellationResult> {
  const parsed =
    cancelSessionAsAdminSchema.parse(
      input,
    );

  return cancelSession({
    actorType:
      "ADMIN",

    actorUserId,

    sessionId:
      parsed.sessionId,

    reason:
      parsed.reason,
  });
}