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
    };

function getBookingLockKey(
  scope: BookingLockScope,
): bigint {
  /*
   * Preserve the teacher lock namespace that
   * Wave 2 availability writes already use.
   */
  const namespace =
    scope.type === "teacher"
      ? `takineo:teacher-availability:${scope.id}`
      : `takineo:student-booking:${scope.id}`;

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
   * Deterministic ordering avoids introducing
   * lock-order deadlocks when a transaction
   * needs multiple booking resources.
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
     * $executeRaw is intentional so Prisma
     * does not try to deserialize that value.
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
