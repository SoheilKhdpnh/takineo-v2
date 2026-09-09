import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
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

let setupClient: Client | null =
  null;

const IDS = {
  teacherUserA:
    "it_wave2_teacher_user_a",
  teacherUserB:
    "it_wave2_teacher_user_b",

  teacherProfileA:
    "it_wave2_teacher_profile_a",
  teacherProfileB:
    "it_wave2_teacher_profile_b",

  studentA:
    "it_wave2_student_a",
  studentB:
    "it_wave2_student_b",
  studentC:
    "it_wave2_student_c",
} as const;

type PgFailure = Error & {
  code?: string;
  constraint?: string;
};

async function createClient(
  applicationName: string,
): Promise<Client> {
  const client = new Client({
    connectionString,
    application_name:
      applicationName,
  });

  await client.connect();

  return client;
}

async function expectPgFailure(
  operation: () => Promise<unknown>,
  expectedCode: string,
  expectedConstraint?: string,
): Promise<PgFailure> {
  try {
    await operation();
  } catch (error) {
    const pgError =
      error as PgFailure;

    expect(pgError.code).toBe(
      expectedCode,
    );

    if (expectedConstraint) {
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

async function cleanupFixtures() {
  if (!setupClient) {
    return;
  }

  await setupClient.query(`
    DELETE FROM
      "speaking_session_cancellation"
    WHERE
      "id" LIKE 'it_wave2_%'
      OR "sessionId" LIKE 'it_wave2_%'
  `);

  await setupClient.query(`
    DELETE FROM "speaking_session"
    WHERE "id" LIKE 'it_wave2_%'
  `);

  await setupClient.query(`
    DELETE FROM
      "teacher_availability_exception"
    WHERE "id" LIKE 'it_wave2_%'
  `);

  await setupClient.query(`
    DELETE FROM
      "teacher_availability_rule"
    WHERE "id" LIKE 'it_wave2_%'
  `);

  await setupClient.query(`
    DELETE FROM "teacher_profile"
    WHERE "id" LIKE 'it_wave2_%'
  `);

  await setupClient.query(`
    DELETE FROM "user"
    WHERE "id" LIKE 'it_wave2_%'
  `);
}

async function seedUsersAndTeachers() {
  if (!setupClient) {
    throw new Error(
      "Integration setup client is unavailable.",
    );
  }

  await setupClient.query(
    `
      INSERT INTO "user" (
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
          'Wave 2 Teacher A',
          'wave2-teacher-a@example.test',
          true,
          'TEACHER',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $2,
          'Wave 2 Teacher B',
          'wave2-teacher-b@example.test',
          true,
          'TEACHER',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $3,
          'Wave 2 Student A',
          'wave2-student-a@example.test',
          true,
          'STUDENT',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $4,
          'Wave 2 Student B',
          'wave2-student-b@example.test',
          true,
          'STUDENT',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $5,
          'Wave 2 Student C',
          'wave2-student-c@example.test',
          true,
          'STUDENT',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
    `,
    [
      IDS.teacherUserA,
      IDS.teacherUserB,
      IDS.studentA,
      IDS.studentB,
      IDS.studentC,
    ],
  );

  await setupClient.query(
    `
      INSERT INTO "teacher_profile" (
        "id",
        "userId",
        "profileCompletedAt",
        "applicationStatus",
        "createdAt",
        "updatedAt"
      )
      VALUES
        (
          $1,
          $2,
          CURRENT_TIMESTAMP,
          'APPROVED',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $3,
          $4,
          CURRENT_TIMESTAMP,
          'APPROVED',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
    `,
    [
      IDS.teacherProfileA,
      IDS.teacherUserA,
      IDS.teacherProfileB,
      IDS.teacherUserB,
    ],
  );
}

type InsertSessionOptions = {
  client?: Client;
  id: string;
  teacherProfileId: string;
  studentUserId: string;
  startAt: string;
  endAt: string;
  key: string;
  status?: "SCHEDULED" |
    "COMPLETED" |
    "CANCELLED";
};

async function insertSession(
  options: InsertSessionOptions,
) {
  const client =
    options.client ??
    setupClient;

  if (!client) {
    throw new Error(
      "Database client is unavailable.",
    );
  }

  return client.query(
    `
      INSERT INTO "speaking_session" (
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
        $4::timestamptz,
        $5::timestamptz,
        $6,
        $7,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `,
    [
      options.id,
      options.teacherProfileId,
      options.studentUserId,
      options.startAt,
      options.endAt,
      options.status ??
        "SCHEDULED",
      options.key,
    ],
  );
}

describe.sequential(
  "Wave 2 booking PostgreSQL constraints",
  () => {
    beforeAll(async () => {
      setupClient =
        await createClient(
          "takineo-wave2-constraints",
        );

      const identity =
        await setupClient.query<{
          database_name: string;
          user_name: string;
          server_address: string;
          server_port: number;
        }>(`
          SELECT
            current_database()::text
              AS database_name,
            current_user::text
              AS user_name,
            host(
              inet_server_addr()
            )::text
              AS server_address,
            inet_server_port()::int
              AS server_port
        `);

      expect(
        identity.rows[0],
      ).toEqual({
        database_name:
          "takineo_test",
        user_name:
          "takineo_test",
        server_address:
          "127.0.0.1",
        server_port: 5432,
      });

      const schema =
        await setupClient.query<{
          speaking_session: boolean;
          availability_rule: boolean;
        }>(`
          SELECT
            to_regclass(
              'public.speaking_session'
            ) IS NOT NULL
              AS speaking_session,

            to_regclass(
              'public.teacher_availability_rule'
            ) IS NOT NULL
              AS availability_rule
        `);

      expect(
        schema.rows[0],
      ).toEqual({
        speaking_session: true,
        availability_rule: true,
      });
    });

    beforeEach(async () => {
      await cleanupFixtures();
      await seedUsersAndTeachers();
    });

    afterEach(async () => {
      await cleanupFixtures();
    });

    afterAll(async () => {
      await cleanupFixtures();

      if (setupClient) {
        await setupClient.end();
        setupClient = null;
      }
    });

    test(
      "active recurring availability cannot overlap while adjacent and inactive windows remain valid",
      async () => {
        await setupClient!.query(`
          INSERT INTO
            "teacher_availability_rule" (
              "id",
              "teacherProfileId",
              "weekday",
              "startMinute",
              "endMinute",
              "isActive",
              "updatedAt"
            )
          VALUES (
            'it_wave2_rule_1',
            '${IDS.teacherProfileA}',
            'SATURDAY',
            540,
            600,
            true,
            CURRENT_TIMESTAMP
          )
        `);

        await setupClient!.query(`
          INSERT INTO
            "teacher_availability_rule" (
              "id",
              "teacherProfileId",
              "weekday",
              "startMinute",
              "endMinute",
              "isActive",
              "updatedAt"
            )
          VALUES (
            'it_wave2_rule_adjacent',
            '${IDS.teacherProfileA}',
            'SATURDAY',
            600,
            660,
            true,
            CURRENT_TIMESTAMP
          )
        `);

        await expectPgFailure(
          () =>
            setupClient!.query(`
              INSERT INTO
                "teacher_availability_rule" (
                  "id",
                  "teacherProfileId",
                  "weekday",
                  "startMinute",
                  "endMinute",
                  "isActive",
                  "updatedAt"
                )
              VALUES (
                'it_wave2_rule_overlap',
                '${IDS.teacherProfileA}',
                'SATURDAY',
                585,
                615,
                true,
                CURRENT_TIMESTAMP
              )
            `),
          "23P01",
          "tar_no_active_overlap",
        );

        await setupClient!.query(`
          INSERT INTO
            "teacher_availability_rule" (
              "id",
              "teacherProfileId",
              "weekday",
              "startMinute",
              "endMinute",
              "isActive",
              "updatedAt"
            )
          VALUES (
            'it_wave2_rule_inactive_overlap',
            '${IDS.teacherProfileA}',
            'SATURDAY',
            570,
            630,
            false,
            CURRENT_TIMESTAMP
          )
        `);

        const count =
          await setupClient!.query<{
            count: number;
          }>(`
            SELECT COUNT(*)::int
              AS count
            FROM
              "teacher_availability_rule"
            WHERE
              "teacherProfileId" =
                '${IDS.teacherProfileA}'
          `);

        expect(
          count.rows[0]?.count,
        ).toBe(3);
      },
    );

    test(
      "availability windows enforce range and 15-minute grid invariants",
      async () => {
        await expectPgFailure(
          () =>
            setupClient!.query(`
              INSERT INTO
                "teacher_availability_rule" (
                  "id",
                  "teacherProfileId",
                  "weekday",
                  "startMinute",
                  "endMinute",
                  "updatedAt"
                )
              VALUES (
                'it_wave2_rule_off_grid',
                '${IDS.teacherProfileA}',
                'SUNDAY',
                541,
                600,
                CURRENT_TIMESTAMP
              )
            `),
          "23514",
          "tar_minute_window_check",
        );

        await expectPgFailure(
          () =>
            setupClient!.query(`
              INSERT INTO
                "teacher_availability_rule" (
                  "id",
                  "teacherProfileId",
                  "weekday",
                  "startMinute",
                  "endMinute",
                  "updatedAt"
                )
              VALUES (
                'it_wave2_rule_reverse',
                '${IDS.teacherProfileA}',
                'SUNDAY',
                600,
                540,
                CURRENT_TIMESTAMP
              )
            `),
          "23514",
          "tar_minute_window_check",
        );

        await expectPgFailure(
          () =>
            setupClient!.query(`
              INSERT INTO
                "teacher_availability_rule" (
                  "id",
                  "teacherProfileId",
                  "weekday",
                  "startMinute",
                  "endMinute",
                  "updatedAt"
                )
              VALUES (
                'it_wave2_rule_overflow',
                '${IDS.teacherProfileA}',
                'SUNDAY',
                1380,
                1455,
                CURRENT_TIMESTAMP
              )
            `),
          "23514",
          "tar_minute_window_check",
        );
      },
    );

    test(
      "date exceptions may overlap, exact duplicate windows stay unique, and notes stay clean",
      async () => {
        await setupClient!.query(`
          INSERT INTO
            "teacher_availability_exception" (
              "id",
              "teacherProfileId",
              "date",
              "startMinute",
              "endMinute",
              "type",
              "note",
              "updatedAt"
            )
          VALUES (
            'it_wave2_exception_1',
            '${IDS.teacherProfileA}',
            DATE '2026-08-15',
            540,
            600,
            'UNAVAILABLE',
            'Appointment',
            CURRENT_TIMESTAMP
          )
        `);

        /*
         * Adjacent exception windows remain legal.
         */
        await setupClient!.query(`
          INSERT INTO
            "teacher_availability_exception" (
              "id",
              "teacherProfileId",
              "date",
              "startMinute",
              "endMinute",
              "type",
              "updatedAt"
            )
          VALUES (
            'it_wave2_exception_adjacent',
            '${IDS.teacherProfileA}',
            DATE '2026-08-15',
            600,
            660,
            'AVAILABLE',
            CURRENT_TIMESTAMP
          )
        `);

        /*
         * Partial overlap is intentionally legal.
         *
         * UNAVAILABLE 09:00 - 10:00
         * AVAILABLE   09:30 - 10:30
         *
         * The availability projection owns precedence;
         * the database must permit both rows to exist.
         */
        await setupClient!.query(`
          INSERT INTO
            "teacher_availability_exception" (
              "id",
              "teacherProfileId",
              "date",
              "startMinute",
              "endMinute",
              "type",
              "updatedAt"
            )
          VALUES (
            'it_wave2_exception_overlap',
            '${IDS.teacherProfileA}',
            DATE '2026-08-15',
            570,
            630,
            'AVAILABLE',
            CURRENT_TIMESTAMP
          )
        `);

        const stored =
          await setupClient!.query<{
            id: string;
            type: string;
            startMinute: number;
            endMinute: number;
          }>(`
            SELECT
              "id",
              "type"::text AS type,
              "startMinute",
              "endMinute"
            FROM
              "teacher_availability_exception"
            WHERE
              "id" IN (
                'it_wave2_exception_1',
                'it_wave2_exception_adjacent',
                'it_wave2_exception_overlap'
              )
            ORDER BY
              "startMinute" ASC,
              "id" ASC
          `);

        expect(
          stored.rows,
        ).toEqual([
          {
            id:
              "it_wave2_exception_1",
            type:
              "UNAVAILABLE",
            startMinute:
              540,
            endMinute:
              600,
          },
          {
            id:
              "it_wave2_exception_overlap",
            type:
              "AVAILABLE",
            startMinute:
              570,
            endMinute:
              630,
          },
          {
            id:
              "it_wave2_exception_adjacent",
            type:
              "AVAILABLE",
            startMinute:
              600,
            endMinute:
              660,
          },
        ]);

        /*
         * Exact duplicate teacher/date/window rows remain
         * prohibited by tae_exact_window_key.
         */
        await expectPgFailure(
          () =>
            setupClient!.query(`
              INSERT INTO
                "teacher_availability_exception" (
                  "id",
                  "teacherProfileId",
                  "date",
                  "startMinute",
                  "endMinute",
                  "type",
                  "updatedAt"
                )
              VALUES (
                'it_wave2_exception_exact_duplicate',
                '${IDS.teacherProfileA}',
                DATE '2026-08-15',
                540,
                600,
                'AVAILABLE',
                CURRENT_TIMESTAMP
              )
            `),
          "23505",
          "tae_exact_window_key",
        );

        /*
         * Notes retain their existing canonical formatting
         * constraint independently of overlap semantics.
         */
        await expectPgFailure(
          () =>
            setupClient!.query(`
              INSERT INTO
                "teacher_availability_exception" (
                  "id",
                  "teacherProfileId",
                  "date",
                  "startMinute",
                  "endMinute",
                  "type",
                  "note",
                  "updatedAt"
                )
              VALUES (
                'it_wave2_exception_bad_note',
                '${IDS.teacherProfileA}',
                DATE '2026-08-16',
                540,
                600,
                'UNAVAILABLE',
                '  padded note  ',
                CURRENT_TIMESTAMP
              )
            `),
          "23514",
          "tae_note_check",
        );
      },
    );
    test(
      "sessions must start on the 15-minute grid and last exactly 15 minutes",
      async () => {
        await expectPgFailure(
          () =>
            insertSession({
              id:
                "it_wave2_session_bad_duration",
              teacherProfileId:
                IDS.teacherProfileA,
              studentUserId:
                IDS.studentA,
              startAt:
                "2026-08-20T05:30:00Z",
              endAt:
                "2026-08-20T05:50:00Z",
              key:
                "bad-duration",
            }),
          "23514",
          "speaking_session_exact_15m_check",
        );

        await expectPgFailure(
          () =>
            insertSession({
              id:
                "it_wave2_session_off_grid",
              teacherProfileId:
                IDS.teacherProfileA,
              studentUserId:
                IDS.studentA,
              startAt:
                "2026-08-20T05:37:00Z",
              endAt:
                "2026-08-20T05:52:00Z",
              key:
                "off-grid",
            }),
          "23514",
          "speaking_session_start_grid_check",
        );

        await expectPgFailure(
          () =>
            insertSession({
              id:
                "it_wave2_session_bad_key",
              teacherProfileId:
                IDS.teacherProfileA,
              studentUserId:
                IDS.studentA,
              startAt:
                "2026-08-20T05:30:00Z",
              endAt:
                "2026-08-20T05:45:00Z",
              key:
                " padded-key ",
            }),
          "23514",
          "speaking_session_idempotency_key_check",
        );
      },
    );

    test(
      "one teacher cannot have two active sessions at the same start",
      async () => {
        await insertSession({
          id:
            "it_wave2_session_teacher_1",
          teacherProfileId:
            IDS.teacherProfileA,
          studentUserId:
            IDS.studentA,
          startAt:
            "2026-08-21T05:30:00Z",
          endAt:
            "2026-08-21T05:45:00Z",
          key:
            "teacher-slot-a",
        });

        await expectPgFailure(
          () =>
            insertSession({
              id:
                "it_wave2_session_teacher_2",
              teacherProfileId:
                IDS.teacherProfileA,
              studentUserId:
                IDS.studentB,
              startAt:
                "2026-08-21T05:30:00Z",
              endAt:
                "2026-08-21T05:45:00Z",
              key:
                "teacher-slot-b",
            }),
          "23505",
          "speaking_session_teacher_active_slot_key",
        );
      },
    );

    test(
      "one student cannot hold two active sessions at the same start",
      async () => {
        await insertSession({
          id:
            "it_wave2_session_student_1",
          teacherProfileId:
            IDS.teacherProfileA,
          studentUserId:
            IDS.studentA,
          startAt:
            "2026-08-22T05:30:00Z",
          endAt:
            "2026-08-22T05:45:00Z",
          key:
            "student-slot-a",
        });

        await expectPgFailure(
          () =>
            insertSession({
              id:
                "it_wave2_session_student_2",
              teacherProfileId:
                IDS.teacherProfileB,
              studentUserId:
                IDS.studentA,
              startAt:
                "2026-08-22T05:30:00Z",
              endAt:
                "2026-08-22T05:45:00Z",
              key:
                "student-slot-b",
            }),
          "23505",
          "speaking_session_student_active_slot_key",
        );
      },
    );

    test(
      "COMPLETED sessions keep historical slot ownership",
      async () => {
        await insertSession({
          id:
            "it_wave2_session_completed",
          teacherProfileId:
            IDS.teacherProfileA,
          studentUserId:
            IDS.studentA,
          startAt:
            "2026-08-23T05:30:00Z",
          endAt:
            "2026-08-23T05:45:00Z",
          key:
            "completed-original",
          status:
            "COMPLETED",
        });

        await expectPgFailure(
          () =>
            insertSession({
              id:
                "it_wave2_session_completed_duplicate",
              teacherProfileId:
                IDS.teacherProfileA,
              studentUserId:
                IDS.studentB,
              startAt:
                "2026-08-23T05:30:00Z",
              endAt:
                "2026-08-23T05:45:00Z",
              key:
                "completed-duplicate",
            }),
          "23505",
          "speaking_session_teacher_active_slot_key",
        );
      },
    );

    test(
  "CANCELLED sessions release the slot for a new booking",
  async () => {
    /*
     * Cancellation history is append-only once
     * committed.
     *
     * Keep this fixture transaction-scoped so
     * ROLLBACK removes the test history without
     * violating production immutability.
     */
    await setupClient!.query(
      "BEGIN",
    );

    try {
      await insertSession({
        id:
          "it_wave2_session_cancelled",

        teacherProfileId:
          IDS.teacherProfileA,

        studentUserId:
          IDS.studentA,

        startAt:
          "2026-08-24T05:30:00Z",

        endAt:
          "2026-08-24T05:45:00Z",

        key:
          "cancelled-original",
      });

      await setupClient!.query(`
        UPDATE
          "speaking_session"
        SET
          "status" = 'CANCELLED',
          "updatedAt" =
            CURRENT_TIMESTAMP
        WHERE
          "id" =
            'it_wave2_session_cancelled'
      `);

      await setupClient!.query(`
        INSERT INTO
          "speaking_session_cancellation" (
            "id",
            "sessionId",
            "actorType",
            "actorUserId",
            "reason"
          )
        VALUES (
          'it_wave2_cancellation_valid',
          'it_wave2_session_cancelled',
          'STUDENT',
          '${IDS.studentA}',
          'Schedule changed'
        )
      `);

      await insertSession({
        id:
          "it_wave2_session_rebooked",

        teacherProfileId:
          IDS.teacherProfileA,

        studentUserId:
          IDS.studentA,

        startAt:
          "2026-08-24T05:30:00Z",

        endAt:
          "2026-08-24T05:45:00Z",

        key:
          "cancelled-rebook",
      });

      const count =
        await setupClient!.query<{
          count: number;
        }>(`
          SELECT
            COUNT(*)::int
              AS count
          FROM
            "speaking_session"
          WHERE
            "teacherProfileId" =
              '${IDS.teacherProfileA}'
            AND
            "startAt" =
              '2026-08-24T05:30:00Z'
              ::timestamptz
        `);

      expect(
        count.rows[0]?.count,
      ).toBe(
        2,
      );
    } finally {
      await setupClient!.query(
        "ROLLBACK",
      );
    }
  },
);

    test(
      "booking idempotency is unique per student across retries",
      async () => {
        await insertSession({
          id:
            "it_wave2_session_idempotent_1",
          teacherProfileId:
            IDS.teacherProfileA,
          studentUserId:
            IDS.studentA,
          startAt:
            "2026-08-25T05:30:00Z",
          endAt:
            "2026-08-25T05:45:00Z",
          key:
            "retry-key-001",
        });

        await expectPgFailure(
          () =>
            insertSession({
              id:
                "it_wave2_session_idempotent_2",
              teacherProfileId:
                IDS.teacherProfileB,
              studentUserId:
                IDS.studentA,
              startAt:
                "2026-08-25T06:00:00Z",
              endAt:
                "2026-08-25T06:15:00Z",
              key:
                "retry-key-001",
            }),
          "23505",
          "speaking_session_student_idempotency_key",
        );

        /*
         * The same opaque key may safely
         * exist for a different student.
         */
        await insertSession({
          id:
            "it_wave2_session_idempotent_other_student",
          teacherProfileId:
            IDS.teacherProfileB,
          studentUserId:
            IDS.studentB,
          startAt:
            "2026-08-25T06:00:00Z",
          endAt:
            "2026-08-25T06:15:00Z",
          key:
            "retry-key-001",
        });
      },
    );

    test(
      "cancellation actor and reason invariants are enforced",
      async () => {
        await insertSession({
          id:
            "it_wave2_session_for_cancellation",
          teacherProfileId:
            IDS.teacherProfileA,
          studentUserId:
            IDS.studentA,
          startAt:
            "2026-08-26T05:30:00Z",
          endAt:
            "2026-08-26T05:45:00Z",
          key:
            "cancellation-fixture",
          status:
            "CANCELLED",
        });

        await expectPgFailure(
          () =>
            setupClient!.query(`
              INSERT INTO
                "speaking_session_cancellation" (
                  "id",
                  "sessionId",
                  "actorType",
                  "actorUserId"
                )
              VALUES (
                'it_wave2_cancel_system_with_user',
                'it_wave2_session_for_cancellation',
                'SYSTEM',
                '${IDS.studentA}'
              )
            `),
          "23514",
          "session_cancellation_actor_user_check",
        );

        await expectPgFailure(
          () =>
            setupClient!.query(`
              INSERT INTO
                "speaking_session_cancellation" (
                  "id",
                  "sessionId",
                  "actorType"
                )
              VALUES (
                'it_wave2_cancel_student_without_user',
                'it_wave2_session_for_cancellation',
                'STUDENT'
              )
            `),
          "23514",
          "session_cancellation_actor_user_check",
        );

        await expectPgFailure(
          () =>
            setupClient!.query(`
              INSERT INTO
                "speaking_session_cancellation" (
                  "id",
                  "sessionId",
                  "actorType",
                  "actorUserId",
                  "reason"
                )
              VALUES (
                'it_wave2_cancel_bad_reason',
                'it_wave2_session_for_cancellation',
                'STUDENT',
                '${IDS.studentA}',
                '   '
              )
            `),
          "23514",
          "session_cancellation_reason_check",
        );

        await setupClient!.query(
          "BEGIN",
        );

        try {
          await setupClient!.query(`
            INSERT INTO
              "speaking_session_cancellation" (
                "id",
                "sessionId",
                "actorType",
                "actorUserId",
                "reason"
              )
            VALUES (
              'it_wave2_cancel_valid',
              'it_wave2_session_for_cancellation',
              'STUDENT',
              '${IDS.studentA}',
              'Cannot attend'
            )
          `);
        } finally {
          await setupClient!.query(
            "ROLLBACK",
          );
        }
      },
    );

    test(
      "booking history restricts destructive teacher and student deletion",
      async () => {
        await insertSession({
          id:
            "it_wave2_session_history",
          teacherProfileId:
            IDS.teacherProfileA,
          studentUserId:
            IDS.studentA,
          startAt:
            "2026-08-27T05:30:00Z",
          endAt:
            "2026-08-27T05:45:00Z",
          key:
            "history-integrity",
        });

        await expectPgFailure(
          () =>
            setupClient!.query(`
              DELETE FROM
                "teacher_profile"
              WHERE "id" =
                '${IDS.teacherProfileA}'
            `),
          "23001",
          "speaking_session_teacherProfileId_fkey",
        );

        await expectPgFailure(
          () =>
            setupClient!.query(`
              DELETE FROM "user"
              WHERE "id" =
                '${IDS.studentA}'
            `),
          "23001",
          "speaking_session_studentUserId_fkey",
        );
      },
    );

    test(
      "simultaneous PostgreSQL inserts allow exactly one owner of a teacher slot",
      async () => {
        const workerA =
          await createClient(
            "takineo-wave2-booker-a",
          );

        const workerB =
          await createClient(
            "takineo-wave2-booker-b",
          );

        try {
          const results =
            await Promise.allSettled([
              insertSession({
                client: workerA,
                id:
                  "it_wave2_concurrent_a",
                teacherProfileId:
                  IDS.teacherProfileA,
                studentUserId:
                  IDS.studentA,
                startAt:
                  "2026-08-28T05:30:00Z",
                endAt:
                  "2026-08-28T05:45:00Z",
                key:
                  "concurrent-a",
              }),
              insertSession({
                client: workerB,
                id:
                  "it_wave2_concurrent_b",
                teacherProfileId:
                  IDS.teacherProfileA,
                studentUserId:
                  IDS.studentB,
                startAt:
                  "2026-08-28T05:30:00Z",
                endAt:
                  "2026-08-28T05:45:00Z",
                key:
                  "concurrent-b",
              }),
            ]);

          const successes =
            results.filter(
              (result) =>
                result.status ===
                "fulfilled",
            );

          const failures =
            results.filter(
              (result) =>
                result.status ===
                "rejected",
            );

          expect(successes).toHaveLength(
            1,
          );

          expect(failures).toHaveLength(
            1,
          );

          const failure =
            failures[0];

          if (
            !failure ||
            failure.status !==
              "rejected"
          ) {
            throw new Error(
              "Expected one rejected booking.",
            );
          }

          const pgError =
            failure.reason as PgFailure;

          expect(pgError.code).toBe(
            "23505",
          );

          expect(
            pgError.constraint,
          ).toBe(
            "speaking_session_teacher_active_slot_key",
          );

          const count =
            await setupClient!.query<{
              count: number;
            }>(`
              SELECT COUNT(*)::int
                AS count
              FROM "speaking_session"
              WHERE
                "teacherProfileId" =
                  '${IDS.teacherProfileA}'
                AND "startAt" =
                  '2026-08-28T05:30:00Z'
                    ::timestamptz
                AND "status" <>
                  'CANCELLED'
            `);

          expect(
            count.rows[0]?.count,
          ).toBe(1);
        } finally {
          await workerA.end();
          await workerB.end();
        }
      },
      15_000,
    );
  },
);
