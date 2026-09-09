import "server-only";

import {
  createHash,
} from "node:crypto";

import {
  Prisma,
} from "@/lib/generated/prisma/client";

type BookingLockScope =
  | {
      type: "teacher";
      id: string;
    }
  | {
      type: "student";
      id: string;
    }
  | {
      type: "session";
      id: string;
    };

function getBookingLockKey(
  scope: BookingLockScope,
): bigint {
  let namespace:
    string;

  switch (
    scope.type
  ) {
    case "teacher":
      /*
       * Preserve the namespace already shared
       * between availability writes and booking.
       */
      namespace =
        `takineo:teacher-availability:${scope.id}`;
      break;

    case "student":
      namespace =
        `takineo:student-booking:${scope.id}`;
      break;

    case "session":
      /*
       * Every future terminal session transition
       * must share this namespace:
       *
       * cancel ↔ complete ↔ future dispute/state
       * transitions.
       */
      namespace =
        `takineo:speaking-session:${scope.id}`;
      break;
  }

  const digest =
    createHash(
      "sha256",
    )
      .update(
        namespace,
      )
      .digest();

  return digest.readBigInt64BE(
    0,
  );
}

async function lockScopes(
  tx:
    Prisma.TransactionClient,
  scopes:
    readonly BookingLockScope[],
): Promise<void> {
  const keyMap =
    new Map<
      string,
      bigint
    >();

  for (
    const scope
    of scopes
  ) {
    const key =
      getBookingLockKey(
        scope,
      );

    keyMap.set(
      key.toString(),
      key,
    );
  }

  /*
   * Deterministic ordering prevents deadlocks
   * when a transaction needs multiple booking
   * resources.
   */
  const keys =
    [...keyMap.values()]
      .sort(
        (
          first,
          second,
        ) => {
          if (
            first <
            second
          ) {
            return -1;
          }

          if (
            first >
            second
          ) {
            return 1;
          }

          return 0;
        },
      );

  for (
    const key
    of keys
  ) {
    /*
     * pg_advisory_xact_lock returns void.
     *
     * $executeRaw is intentional so Prisma does
     * not try to deserialize PostgreSQL void.
     */
    await tx.$executeRaw`
      SELECT
        pg_advisory_xact_lock(
          ${key}
        )
    `;
  }
}

export async function lockTeacherBookingScope(
  tx:
    Prisma.TransactionClient,
  teacherUserId: string,
): Promise<void> {
  await lockScopes(
    tx,
    [
      {
        type:
          "teacher",

        id:
          teacherUserId,
      },
    ],
  );
}

export async function lockStudentAndTeacherBookingScopes(
  tx:
    Prisma.TransactionClient,
  input: {
    studentUserId: string;
    teacherUserId: string;
  },
): Promise<void> {
  await lockScopes(
    tx,
    [
      {
        type:
          "student",

        id:
          input.studentUserId,
      },
      {
        type:
          "teacher",

        id:
          input.teacherUserId,
      },
    ],
  );
}

export async function lockSpeakingSessionScope(
  tx:
    Prisma.TransactionClient,
  sessionId: string,
): Promise<void> {
  await lockScopes(
    tx,
    [
      {
        type:
          "session",

        id:
          sessionId,
      },
    ],
  );
}
