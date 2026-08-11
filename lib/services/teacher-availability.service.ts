import "server-only";

import {
  createHash,
} from "node:crypto";

import {
  prisma,
} from "@/lib/db/prisma";
import {
  canCreateAvailability,
} from "@/lib/domain/teacher-application";
import {
  BOOKING_MAX_AVAILABILITY_QUERY_DAYS,
} from "@/lib/domain/booking-policy";
import {
  parseBookingDateKey,
} from "@/lib/domain/booking";
import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import {
  TeacherAvailabilityConflictError,
  TeacherAvailabilityExceptionNotFoundError,
  TeacherAvailabilityRangeError,
  TeacherAvailabilityStateError,
} from "@/lib/errors/teacher-availability-errors";
import {
  Prisma,
} from "@/lib/generated/prisma/client";
import {
  runSerializableTransaction,
} from "@/lib/services/serializable-transaction";
import {
  replaceTeacherAvailabilitySchema,
  teacherAvailabilityExceptionSchema,
  type ReplaceTeacherAvailabilityInput,
  type TeacherAvailabilityExceptionInput,
} from "@/lib/validations/teacher-availability";

const DAY_MS =
  24 * 60 * 60 * 1000;

const teacherAvailabilityRuleSelect = {
  id: true,
  teacherProfileId: true,
  weekday: true,
  startMinute: true,
  endMinute: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies
  Prisma.TeacherAvailabilityRuleSelect;

const teacherAvailabilityExceptionSelect = {
  id: true,
  teacherProfileId: true,
  date: true,
  startMinute: true,
  endMinute: true,
  type: true,
  note: true,
  createdAt: true,
  updatedAt: true,
} satisfies
  Prisma.TeacherAvailabilityExceptionSelect;

type TeacherAvailabilityRuleRow =
  Prisma.TeacherAvailabilityRuleGetPayload<{
    select:
      typeof teacherAvailabilityRuleSelect;
  }>;

type TeacherAvailabilityExceptionRow =
  Prisma.TeacherAvailabilityExceptionGetPayload<{
    select:
      typeof teacherAvailabilityExceptionSelect;
  }>;

export type TeacherAvailabilityRuleRecord =
  TeacherAvailabilityRuleRow;

export type TeacherAvailabilityExceptionRecord =
  Omit<
    TeacherAvailabilityExceptionRow,
    "date"
  > & {
    date: string;
  };

export type TeacherAvailabilitySnapshot = {
  rules:
    TeacherAvailabilityRuleRecord[];

  exceptions:
    TeacherAvailabilityExceptionRecord[];
};

export type TeacherAvailabilityDateRange = {
  fromDate: string;
  toDate: string;
};

type TeacherContextDatabase =
  Pick<
    Prisma.TransactionClient,
    "user"
  >;

function toDatabaseDate(
  dateKey: string,
): Date {
  const {
    year,
    month,
    day,
  } = parseBookingDateKey(
    dateKey,
  );

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
    ),
  );
}

function toDateKey(
  value: Date,
): string {
  return value
    .toISOString()
    .slice(0, 10);
}

function validateDateRange(
  range:
    TeacherAvailabilityDateRange,
): {
  fromDate: Date;
  toDate: Date;
} {
  let fromDate: Date;
  let toDate: Date;

  try {
    fromDate =
      toDatabaseDate(
        range.fromDate,
      );

    toDate =
      toDatabaseDate(
        range.toDate,
      );
  } catch {
    throw new TeacherAvailabilityRangeError(
      "INVALID_DATE_RANGE",
    );
  }

  if (
    toDate.getTime() <
    fromDate.getTime()
  ) {
    throw new TeacherAvailabilityRangeError(
      "INVALID_DATE_RANGE",
    );
  }

  const inclusiveDays =
    Math.floor(
      (
        toDate.getTime() -
        fromDate.getTime()
      ) /
        DAY_MS,
    ) + 1;

  if (
    inclusiveDays >
    BOOKING_MAX_AVAILABILITY_QUERY_DAYS
  ) {
    throw new TeacherAvailabilityRangeError(
      "RANGE_TOO_LARGE",
    );
  }

  return {
    fromDate,
    toDate,
  };
}

function toExceptionRecord(
  row:
    TeacherAvailabilityExceptionRow,
): TeacherAvailabilityExceptionRecord {
  return {
    ...row,

    date:
      toDateKey(
        row.date,
      ),
  };
}

async function getTeacherAvailabilityContext(
  db:
    TeacherContextDatabase,
  userId: string,
): Promise<{
  teacherProfileId: string;
}> {
  const user =
    await db.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        accountStatus: true,
        role: true,

        teacherProfile: {
          select: {
            id: true,

            applicationStatus:
              true,
          },
        },
      },
    });

  if (
    !user ||
    user.accountStatus !==
      "ACTIVE"
  ) {
    throw new ProfileNotFoundError();
  }

  if (
    user.role !==
    "TEACHER"
  ) {
    throw new ProfileRoleMismatchError();
  }

  if (
    !user.teacherProfile
  ) {
    throw new ProfileNotFoundError();
  }

  if (
    !canCreateAvailability(
      user.teacherProfile
        .applicationStatus,
    )
  ) {
    throw new TeacherAvailabilityStateError();
  }

  return {
    teacherProfileId:
      user.teacherProfile.id,
  };
}

function getAvailabilityLockKey(
  userId: string,
): bigint {
  const digest =
    createHash(
      "sha256",
    )
      .update(
        `takineo:teacher-availability:${userId}`,
      )
      .digest();

  return digest.readBigInt64BE(
    0,
  );
}

async function lockTeacherAvailability(
  tx:
    Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const lockKey =
    getAvailabilityLockKey(
      userId,
    );

  /*
   * pg_advisory_xact_lock returns PostgreSQL
   * void. $queryRaw would attempt to deserialize
   * that unsupported value.
   *
   * $executeRaw executes the statement without
   * asking Prisma to deserialize the void result.
   *
   * Because this is a transaction-level advisory
   * lock, PostgreSQL releases it automatically
   * when the surrounding transaction completes.
   */
  await tx.$executeRaw`
    SELECT
      pg_advisory_xact_lock(
        ${lockKey}
      )
  `;
}

function translateAvailabilityWriteError(
  error: unknown,
): never {
  if (
    error instanceof
      TeacherAvailabilityConflictError ||
    error instanceof
      TeacherAvailabilityStateError ||
    error instanceof
      TeacherAvailabilityExceptionNotFoundError ||
    error instanceof
      ProfileNotFoundError ||
    error instanceof
      ProfileRoleMismatchError
  ) {
    throw error;
  }

  if (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    [
      "P2002",
      "P2004",
      "P2034",
    ].includes(
      error.code,
    )
  ) {
    throw new TeacherAvailabilityConflictError();
  }

  throw error;
}

export async function getTeacherAvailabilityForUser(
  userId: string,
  range:
    TeacherAvailabilityDateRange,
): Promise<TeacherAvailabilitySnapshot> {
  const {
    fromDate,
    toDate,
  } = validateDateRange(
    range,
  );

  const context =
    await getTeacherAvailabilityContext(
      prisma,
      userId,
    );

  const [
    rules,
    exceptions,
  ] =
    await Promise.all([
      prisma
        .teacherAvailabilityRule
        .findMany({
          where: {
            teacherProfileId:
              context
                .teacherProfileId,
          },

          select:
            teacherAvailabilityRuleSelect,

          orderBy: [
            {
              weekday:
                "asc",
            },
            {
              startMinute:
                "asc",
            },
            {
              endMinute:
                "asc",
            },
          ],
        }),

      prisma
        .teacherAvailabilityException
        .findMany({
          where: {
            teacherProfileId:
              context
                .teacherProfileId,

            date: {
              gte:
                fromDate,

              lte:
                toDate,
            },
          },

          select:
            teacherAvailabilityExceptionSelect,

          orderBy: [
            {
              date:
                "asc",
            },
            {
              startMinute:
                "asc",
            },
          ],
        }),
    ]);

  return {
    rules,

    exceptions:
      exceptions.map(
        toExceptionRecord,
      ),
  };
}

export async function replaceTeacherWeeklyAvailability(
  userId: string,
  input:
    ReplaceTeacherAvailabilityInput,
): Promise<
  TeacherAvailabilityRuleRecord[]
> {
  const parsed =
    replaceTeacherAvailabilitySchema.parse(
      input,
    );

  try {
    return await runSerializableTransaction(
      async (tx) => {
        /*
         * Acquire the teacher-scoped lock before
         * any authorization read or availability
         * mutation in this transaction.
         */
        await lockTeacherAvailability(
          tx,
          userId,
        );

        const context =
          await getTeacherAvailabilityContext(
            tx,
            userId,
          );

        await tx
          .teacherAvailabilityRule
          .deleteMany({
            where: {
              teacherProfileId:
                context
                  .teacherProfileId,
            },
          });

        if (
          parsed.rules.length >
          0
        ) {
          await tx
            .teacherAvailabilityRule
            .createMany({
              data:
                parsed.rules.map(
                  (rule) => ({
                    teacherProfileId:
                      context
                        .teacherProfileId,

                    weekday:
                      rule.weekday,

                    startMinute:
                      rule.startMinute,

                    endMinute:
                      rule.endMinute,

                    isActive:
                      rule.isActive,
                  }),
                ),
            });
        }

        return tx
          .teacherAvailabilityRule
          .findMany({
            where: {
              teacherProfileId:
                context
                  .teacherProfileId,
            },

            select:
              teacherAvailabilityRuleSelect,

            orderBy: [
              {
                weekday:
                  "asc",
              },
              {
                startMinute:
                  "asc",
              },
              {
                endMinute:
                  "asc",
              },
            ],
          });
      },
      {
        maxAttempts: 3,

        conflictErrorFactory:
          () =>
            new TeacherAvailabilityConflictError(),
      },
    );
  } catch (error) {
    return translateAvailabilityWriteError(
      error,
    );
  }
}

export async function createTeacherAvailabilityException(
  userId: string,
  input:
    TeacherAvailabilityExceptionInput,
): Promise<TeacherAvailabilityExceptionRecord> {
  const parsed =
    teacherAvailabilityExceptionSchema.parse(
      input,
    );

  try {
    const row =
      await runSerializableTransaction(
        async (tx) => {
          await lockTeacherAvailability(
            tx,
            userId,
          );

          const context =
            await getTeacherAvailabilityContext(
              tx,
              userId,
            );

          return tx
            .teacherAvailabilityException
            .create({
              data: {
                teacherProfileId:
                  context
                    .teacherProfileId,

                date:
                  toDatabaseDate(
                    parsed.date,
                  ),

                startMinute:
                  parsed.startMinute,

                endMinute:
                  parsed.endMinute,

                type:
                  parsed.type,

                note:
                  parsed.note ??
                  null,
              },

              select:
                teacherAvailabilityExceptionSelect,
            });
        },
        {
          maxAttempts: 3,

          conflictErrorFactory:
            () =>
              new TeacherAvailabilityConflictError(),
        },
      );

    return toExceptionRecord(
      row,
    );
  } catch (error) {
    return translateAvailabilityWriteError(
      error,
    );
  }
}

export async function deleteTeacherAvailabilityException(
  userId: string,
  exceptionId: string,
): Promise<void> {
  if (
    exceptionId.length === 0 ||
    exceptionId !==
      exceptionId.trim()
  ) {
    throw new TeacherAvailabilityExceptionNotFoundError();
  }

  try {
    await runSerializableTransaction(
      async (tx) => {
        await lockTeacherAvailability(
          tx,
          userId,
        );

        const context =
          await getTeacherAvailabilityContext(
            tx,
            userId,
          );

        const result =
          await tx
            .teacherAvailabilityException
            .deleteMany({
              where: {
                id:
                  exceptionId,

                teacherProfileId:
                  context
                    .teacherProfileId,
              },
            });

        if (
          result.count !== 1
        ) {
          throw new TeacherAvailabilityExceptionNotFoundError();
        }
      },
      {
        maxAttempts: 3,

        conflictErrorFactory:
          () =>
            new TeacherAvailabilityConflictError(),
      },
    );
  } catch (error) {
    translateAvailabilityWriteError(
      error,
    );
  }
}