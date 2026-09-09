import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
} from "vitest";

import {
  Client,
} from "pg";

import {
  getTestDatabaseUrl,
} from "@/tests/support/test-database-url";

const connectionString =
  getTestDatabaseUrl();

let client:
  Client;

type PgFailure =
  Error & {
    code?: string;
    constraint?: string;
  };

async function expectPgFailure(
  operation:
    () => Promise<unknown>,
  expectedCode:
    string,
  expectedConstraint?:
    string,
): Promise<PgFailure> {
  try {
    await operation();
  } catch (error) {
    const pgError =
      error as PgFailure;

    expect(
      pgError.code,
    ).toBe(
      expectedCode,
    );

    if (
      expectedConstraint
    ) {
      expect(
        pgError.constraint,
      ).toBe(
        expectedConstraint,
      );
    }

    return pgError;
  }

  throw new Error(
    `Expected PostgreSQL error ${expectedCode}${
      expectedConstraint
        ? ` on ${expectedConstraint}`
        : ""
    }, but the operation succeeded.`,
  );
}

async function beginFixture(
  suffix: string,
): Promise<{
  studentUserId:
    string;

  teacherUserId:
    string;

  teacherProfileId:
    string;

  sessionId:
    string;

  cancellationId:
    string;
}> {
  const studentUserId =
    `it_cancel_constraints_student_${suffix}`;

  const teacherUserId =
    `it_cancel_constraints_teacher_${suffix}`;

  const teacherProfileId =
    `it_cancel_constraints_profile_${suffix}`;

  const sessionId =
    `it_cancel_constraints_session_${suffix}`;

  const cancellationId =
    `it_cancel_constraints_history_${suffix}`;

  await client.query(
    "BEGIN",
  );

  await client.query(
    `
      INSERT INTO
        "user" (
          "id",
          "name",
          "email",
          "emailVerified",
          "role",
          "accountStatus",
          "createdAt",
          "updatedAt"
        )
      VALUES
        (
          $1,
          'Cancellation Constraint Student',
          $2,
          true,
          'STUDENT',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $3,
          'Cancellation Constraint Teacher',
          $4,
          true,
          'TEACHER',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
    `,
    [
      studentUserId,
      `${studentUserId}@example.test`,
      teacherUserId,
      `${teacherUserId}@example.test`,
    ],
  );

  await client.query(
    `
      INSERT INTO
        "teacher_profile" (
          "id",
          "userId",
          "profileCompletedAt",
          "applicationStatus",
          "createdAt",
          "updatedAt"
        )
      VALUES (
        $1,
        $2,
        CURRENT_TIMESTAMP,
        'APPROVED',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [
      teacherProfileId,
      teacherUserId,
    ],
  );

  await client.query(
    `
      INSERT INTO
        "speaking_session" (
          "id",
          "teacherProfileId",
          "studentUserId",
          "startAt",
          "endAt",
          "status",
          "bookingIdempotencyKey",
          "createdAt",
          "updatedAt"
        )
      VALUES (
        $1,
        $2,
        $3,
        TIMESTAMPTZ
          '2026-08-20 08:00:00+00',
        TIMESTAMPTZ
          '2026-08-20 08:15:00+00',
        'CANCELLED',
        $4,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [
      sessionId,
      teacherProfileId,
      studentUserId,
      `constraint-${suffix}-idempotency`,
    ],
  );

  return {
    studentUserId,
    teacherUserId,
    teacherProfileId,
    sessionId,
    cancellationId,
  };
}

async function rollback():
  Promise<void> {
  await client.query(
    "ROLLBACK",
  );
}

describe.sequential(
  "Wave 2 cancellation PostgreSQL constraints",
  () => {
    beforeAll(
      async () => {
        client =
          new Client({
            connectionString,

            application_name:
              "takineo-wave2-cancellation-constraints",
          });

        await client.connect();
      },
    );

    afterAll(
      async () => {
        await client.end();
      },
    );

    test(
      "allows a student cancellation without a reason",
      async () => {
        const fixture =
          await beginFixture(
            "student_null_reason",
          );

        try {
          await client.query(
            `
              INSERT INTO
                "speaking_session_cancellation" (
                  "id",
                  "sessionId",
                  "actorType",
                  "actorUserId",
                  "reason"
                )
              VALUES (
                $1,
                $2,
                'STUDENT',
                $3,
                NULL
              )
            `,
            [
              fixture
                .cancellationId,

              fixture
                .sessionId,

              fixture
                .studentUserId,
            ],
          );

          const result =
            await client.query<{
              count:
                number;
            }>(
              `
                SELECT
                  COUNT(*)::int
                    AS "count"
                FROM
                  "speaking_session_cancellation"
                WHERE
                  "id" = $1
              `,
              [
                fixture
                  .cancellationId,
              ],
            );

          expect(
            result.rows[0]
              ?.count,
          ).toBe(
            1,
          );
        } finally {
          await rollback();
        }
      },
    );

    test.each([
      "TEACHER",
      "ADMIN",
      "SYSTEM",
    ] as const)(
      "rejects a missing reason for %s cancellation",
      async (
        actorType,
      ) => {
        const fixture =
          await beginFixture(
            `missing_reason_${actorType.toLowerCase()}`,
          );

        try {
          await expectPgFailure(
            () =>
              client.query(
                `
                  INSERT INTO
                    "speaking_session_cancellation" (
                      "id",
                      "sessionId",
                      "actorType",
                      "actorUserId",
                      "reason"
                    )
                  VALUES (
                    $1,
                    $2,
                    $3::"SpeakingSessionCancellationActor",
                    $4,
                    NULL
                  )
                `,
                [
                  fixture
                    .cancellationId,

                  fixture
                    .sessionId,

                  actorType,

                  actorType ===
                    "SYSTEM"
                    ? null
                    : fixture
                        .teacherUserId,
                ],
              ),
            "23514",
            "session_cancellation_reason_check",
          );
        } finally {
          await rollback();
        }
      },
    );

    test(
      "rejects UPDATE of committed-shape cancellation history",
      async () => {
        const fixture =
          await beginFixture(
            "immutable_update",
          );

        try {
          await client.query(
            `
              INSERT INTO
                "speaking_session_cancellation" (
                  "id",
                  "sessionId",
                  "actorType",
                  "actorUserId",
                  "reason"
                )
              VALUES (
                $1,
                $2,
                'STUDENT',
                $3,
                'Original reason'
              )
            `,
            [
              fixture
                .cancellationId,

              fixture
                .sessionId,

              fixture
                .studentUserId,
            ],
          );

          await client.query(
            "SAVEPOINT before_mutation",
          );

          await expectPgFailure(
            () =>
              client.query(
                `
                  UPDATE
                    "speaking_session_cancellation"
                  SET
                    "reason" =
                      'Changed reason'
                  WHERE
                    "id" = $1
                `,
                [
                  fixture
                    .cancellationId,
                ],
              ),
            "23514",
          );

          await client.query(
            "ROLLBACK TO SAVEPOINT before_mutation",
          );

          const result =
            await client.query<{
              reason:
                string | null;
            }>(
              `
                SELECT
                  "reason"
                FROM
                  "speaking_session_cancellation"
                WHERE
                  "id" = $1
              `,
              [
                fixture
                  .cancellationId,
              ],
            );

          expect(
            result.rows[0]
              ?.reason,
          ).toBe(
            "Original reason",
          );
        } finally {
          await rollback();
        }
      },
    );

    test(
      "rejects DELETE of cancellation history",
      async () => {
        const fixture =
          await beginFixture(
            "immutable_delete",
          );

        try {
          await client.query(
            `
              INSERT INTO
                "speaking_session_cancellation" (
                  "id",
                  "sessionId",
                  "actorType",
                  "actorUserId",
                  "reason"
                )
              VALUES (
                $1,
                $2,
                'TEACHER',
                $3,
                'Teacher emergency'
              )
            `,
            [
              fixture
                .cancellationId,

              fixture
                .sessionId,

              fixture
                .teacherUserId,
            ],
          );

          await client.query(
            "SAVEPOINT before_mutation",
          );

          await expectPgFailure(
            () =>
              client.query(
                `
                  DELETE FROM
                    "speaking_session_cancellation"
                  WHERE
                    "id" = $1
                `,
                [
                  fixture
                    .cancellationId,
                ],
              ),
            "23514",
          );

          await client.query(
            "ROLLBACK TO SAVEPOINT before_mutation",
          );

          const result =
            await client.query<{
              count:
                number;
            }>(
              `
                SELECT
                  COUNT(*)::int
                    AS "count"
                FROM
                  "speaking_session_cancellation"
                WHERE
                  "id" = $1
              `,
              [
                fixture
                  .cancellationId,
              ],
            );

          expect(
            result.rows[0]
              ?.count,
          ).toBe(
            1,
          );
        } finally {
          await rollback();
        }
      },
    );

    test(
      "rejects TRUNCATE of cancellation history",
      async () => {
        const fixture =
          await beginFixture(
            "immutable_truncate",
          );

        try {
          await client.query(
            `
              INSERT INTO
                "speaking_session_cancellation" (
                  "id",
                  "sessionId",
                  "actorType",
                  "actorUserId",
                  "reason"
                )
              VALUES (
                $1,
                $2,
                'STUDENT',
                $3,
                'Cannot attend'
              )
            `,
            [
              fixture
                .cancellationId,

              fixture
                .sessionId,

              fixture
                .studentUserId,
            ],
          );

          await client.query(
            "SAVEPOINT before_mutation",
          );

          await expectPgFailure(
            () =>
              client.query(
                `
                  TRUNCATE TABLE
                    "speaking_session_cancellation"
                `,
              ),
            "23514",
          );

          await client.query(
            "ROLLBACK TO SAVEPOINT before_mutation",
          );

          const result =
            await client.query<{
              count:
                number;
            }>(
              `
                SELECT
                  COUNT(*)::int
                    AS "count"
                FROM
                  "speaking_session_cancellation"
                WHERE
                  "id" = $1
              `,
              [
                fixture
                  .cancellationId,
              ],
            );

          expect(
            result.rows[0]
              ?.count,
          ).toBe(
            1,
          );
        } finally {
          await rollback();
        }
      },
    );
  },
);
