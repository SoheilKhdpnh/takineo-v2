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
  teacherUser:
    "it_wave3_teacher_user",
  teacherProfile:
    "it_wave3_teacher_profile",
  studentUser:
    "it_wave3_student_user",
  otherStudentUser:
    "it_wave3_other_student_user",
  session:
    "it_wave3_session",
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
      "speaking_session_live_event"
    WHERE
      "id" LIKE 'it_wave3_%'
      OR "sessionId" LIKE 'it_wave3_%'
  `);

  await setupClient.query(`
    DELETE FROM
      "speaking_session_live_grant"
    WHERE
      "id" LIKE 'it_wave3_%'
      OR "sessionId" LIKE 'it_wave3_%'
  `);

  await setupClient.query(`
    DELETE FROM "speaking_session"
    WHERE "id" LIKE 'it_wave3_%'
  `);

  await setupClient.query(`
    DELETE FROM "teacher_profile"
    WHERE "id" LIKE 'it_wave3_%'
  `);

  await setupClient.query(`
    DELETE FROM "user"
    WHERE "id" LIKE 'it_wave3_%'
  `);
}

async function seedSessionFixture() {
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
          'Wave 3 Teacher',
          'wave3-teacher@example.test',
          true,
          'TEACHER',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $2,
          'Wave 3 Student',
          'wave3-student@example.test',
          true,
          'STUDENT',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $3,
          'Wave 3 Other Student',
          'wave3-other-student@example.test',
          true,
          'STUDENT',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
    `,
    [
      IDS.teacherUser,
      IDS.studentUser,
      IDS.otherStudentUser,
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
      IDS.teacherProfile,
      IDS.teacherUser,
    ],
  );

  /*
   * The booked window must satisfy the pre-existing
   * Wave 2 grid and exact-duration checks. Wave 3
   * consumes those rules and never redefines them.
   */
  await setupClient.query(
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
        '2026-09-01T05:30:00Z'::timestamptz,
        '2026-09-01T05:45:00Z'::timestamptz,
        'SCHEDULED',
        'wave3-live-fixture',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [
      IDS.session,
      IDS.teacherProfile,
      IDS.studentUser,
    ],
  );
}

type InsertGrantOptions = {
  client?: Client;
  id: string;
  participantUserId: string;
  participantRole: "STUDENT" | "TEACHER";
  clientJoinAttemptId: string;
  providerParticipantRef: string;
  sessionId?: string;
};

async function insertGrant(
  options: InsertGrantOptions,
) {
  const client =
    options.client ?? setupClient;

  if (!client) {
    throw new Error(
      "Database client is unavailable.",
    );
  }

  return client.query(
    `
      INSERT INTO
        "speaking_session_live_grant" (
          "id",
          "sessionId",
          "participantUserId",
          "participantRole",
          "clientJoinAttemptId",
          "providerParticipantRef"
        )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
      )
      RETURNING "id"
    `,
    [
      options.id,
      options.sessionId ??
        IDS.session,
      options.participantUserId,
      options.participantRole,
      options.clientJoinAttemptId,
      options.providerParticipantRef,
    ],
  );
}

type InsertEventOptions = {
  client?: Client;
  id: string;
  providerEventRef: string;
  type:
    | "PARTICIPANT_CONNECTED"
    | "PARTICIPANT_DISCONNECTED"
    | "ROOM_ENDED";
  occurredAt?: string;
  providerParticipantRef?: string | null;
  connectionRef?: string | null;
  sessionId?: string;
  onConflictDoNothing?: boolean;
};

async function insertEvent(
  options: InsertEventOptions,
) {
  const client =
    options.client ?? setupClient;

  if (!client) {
    throw new Error(
      "Database client is unavailable.",
    );
  }

  return client.query(
    `
      INSERT INTO
        "speaking_session_live_event" (
          "id",
          "sessionId",
          "providerEventRef",
          "type",
          "occurredAt",
          "providerParticipantRef",
          "connectionRef"
        )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5::timestamptz,
        $6,
        $7
      )
      ${
        options.onConflictDoNothing
          ? "ON CONFLICT DO NOTHING"
          : ""
      }
      RETURNING "id"
    `,
    [
      options.id,
      options.sessionId ??
        IDS.session,
      options.providerEventRef,
      options.type,
      options.occurredAt ??
        "2026-09-01T05:31:00Z",
      options.providerParticipantRef ??
        null,
      options.connectionRef ?? null,
    ],
  );
}

describe.sequential(
  "Wave 3 live session PostgreSQL constraints",
  () => {
    beforeAll(async () => {
      setupClient =
        await createClient(
          "takineo-wave3-live-constraints",
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
          live_grant: boolean;
          live_event: boolean;
        }>(`
          SELECT
            to_regclass(
              'public.speaking_session_live_grant'
            ) IS NOT NULL
              AS live_grant,

            to_regclass(
              'public.speaking_session_live_event'
            ) IS NOT NULL
              AS live_event
        `);

      expect(
        schema.rows[0],
      ).toEqual({
        live_grant: true,
        live_event: true,
      });
    });

    beforeEach(async () => {
      await cleanupFixtures();
      await seedSessionFixture();
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
      "a provider participant reference belongs to exactly one grant",
      async () => {
        await insertGrant({
          id: "it_wave3_grant_first",
          participantUserId:
            IDS.studentUser,
          participantRole: "STUDENT",
          clientJoinAttemptId:
            "attempt-001",
          providerParticipantRef:
            "provider-participant-shared",
        });

        /*
         * A different participant and a different
         * join attempt still may not reuse the
         * provider participant reference, because
         * reference reuse would let one identity
         * inherit another identity's evidence.
         */
        await expectPgFailure(
          () =>
            insertGrant({
              id: "it_wave3_grant_ref_reuse",
              participantUserId:
                IDS.teacherUser,
              participantRole:
                "TEACHER",
              clientJoinAttemptId:
                "attempt-002",
              providerParticipantRef:
                "provider-participant-shared",
            }),
          "23505",
          "ss_live_grant_provider_participant_key",
        );
      },
    );

    test(
      "a replayed join attempt is a database conflict rather than a second grant",
      async () => {
        await insertGrant({
          id: "it_wave3_grant_attempt_first",
          participantUserId:
            IDS.studentUser,
          participantRole: "STUDENT",
          clientJoinAttemptId:
            "attempt-replayed",
          providerParticipantRef:
            "provider-participant-a",
        });

        await expectPgFailure(
          () =>
            insertGrant({
              id: "it_wave3_grant_attempt_replay",
              participantUserId:
                IDS.studentUser,
              participantRole:
                "STUDENT",
              clientJoinAttemptId:
                "attempt-replayed",
              providerParticipantRef:
                "provider-participant-b",
            }),
          "23505",
          "ss_live_grant_join_attempt_key",
        );

        /*
         * The join attempt identifier is client
         * supplied and therefore only unique per
         * participant, never globally.
         */
        await insertGrant({
          id: "it_wave3_grant_attempt_other_user",
          participantUserId:
            IDS.otherStudentUser,
          participantRole: "STUDENT",
          clientJoinAttemptId:
            "attempt-replayed",
          providerParticipantRef:
            "provider-participant-c",
        });

        const count =
          await setupClient!.query<{
            count: number;
          }>(`
            SELECT COUNT(*)::int AS count
            FROM
              "speaking_session_live_grant"
            WHERE
              "clientJoinAttemptId" =
                'attempt-replayed'
          `);

        expect(
          count.rows[0]?.count,
        ).toBe(2);
      },
    );

    test(
      "blank and untrimmed grant references are rejected by the database",
      async () => {
        await expectPgFailure(
          () =>
            insertGrant({
              id: "it_wave3_grant_empty_attempt",
              participantUserId:
                IDS.studentUser,
              participantRole:
                "STUDENT",
              clientJoinAttemptId: "",
              providerParticipantRef:
                "provider-participant-valid",
            }),
          "23514",
          "ss_live_grant_join_attempt_format_check",
        );

        await expectPgFailure(
          () =>
            insertGrant({
              id: "it_wave3_grant_padded_attempt",
              participantUserId:
                IDS.studentUser,
              participantRole:
                "STUDENT",
              clientJoinAttemptId:
                "   ",
              providerParticipantRef:
                "provider-participant-valid",
            }),
          "23514",
          "ss_live_grant_join_attempt_format_check",
        );

        await expectPgFailure(
          () =>
            insertGrant({
              id: "it_wave3_grant_empty_ref",
              participantUserId:
                IDS.studentUser,
              participantRole:
                "STUDENT",
              clientJoinAttemptId:
                "attempt-valid",
              providerParticipantRef:
                "",
            }),
          "23514",
          "ss_live_grant_provider_participant_format_check",
        );

        await expectPgFailure(
          () =>
            insertGrant({
              id: "it_wave3_grant_padded_ref",
              participantUserId:
                IDS.studentUser,
              participantRole:
                "STUDENT",
              clientJoinAttemptId:
                "attempt-valid",
              providerParticipantRef:
                "  provider-participant-padded  ",
            }),
          "23514",
          "ss_live_grant_provider_participant_format_check",
        );
      },
    );

    test(
      "duplicate provider delivery of one event is a database level no-op",
      async () => {
        await insertEvent({
          id: "it_wave3_event_first",
          providerEventRef:
            "provider-event-retried",
          type:
            "PARTICIPANT_CONNECTED",
          providerParticipantRef:
            "provider-participant-a",
          connectionRef:
            "connection-a",
        });

        /*
         * A naive retry surfaces as a unique
         * violation on the event reference rather
         * than as a duplicated presence record.
         */
        await expectPgFailure(
          () =>
            insertEvent({
              id: "it_wave3_event_retry",
              providerEventRef:
                "provider-event-retried",
              type:
                "PARTICIPANT_CONNECTED",
              providerParticipantRef:
                "provider-participant-a",
              connectionRef:
                "connection-a",
            }),
          "23505",
          "ss_live_event_provider_event_key",
        );

        /*
         * Ingestion may therefore treat redelivery
         * as an idempotent no-op instead of guessing
         * at the application layer.
         */
        const conflictResult =
          await insertEvent({
            id: "it_wave3_event_retry_noop",
            providerEventRef:
              "provider-event-retried",
            type:
              "PARTICIPANT_CONNECTED",
            providerParticipantRef:
              "provider-participant-a",
            connectionRef:
              "connection-a",
            onConflictDoNothing: true,
          });

        expect(
          conflictResult.rowCount,
        ).toBe(0);

        const count =
          await setupClient!.query<{
            count: number;
          }>(`
            SELECT COUNT(*)::int AS count
            FROM
              "speaking_session_live_event"
            WHERE
              "providerEventRef" =
                'provider-event-retried'
          `);

        expect(
          count.rows[0]?.count,
        ).toBe(1);
      },
    );

    test(
      "ROOM_ENDED cannot carry participant fields",
      async () => {
        await expectPgFailure(
          () =>
            insertEvent({
              id: "it_wave3_event_room_with_participant",
              providerEventRef:
                "provider-event-room-1",
              type: "ROOM_ENDED",
              providerParticipantRef:
                "provider-participant-a",
              connectionRef: null,
            }),
          "23514",
          "ss_live_event_participant_shape_check",
        );

        await expectPgFailure(
          () =>
            insertEvent({
              id: "it_wave3_event_room_with_connection",
              providerEventRef:
                "provider-event-room-2",
              type: "ROOM_ENDED",
              providerParticipantRef:
                null,
              connectionRef:
                "connection-a",
            }),
          "23514",
          "ss_live_event_participant_shape_check",
        );

        await expectPgFailure(
          () =>
            insertEvent({
              id: "it_wave3_event_room_with_both",
              providerEventRef:
                "provider-event-room-3",
              type: "ROOM_ENDED",
              providerParticipantRef:
                "provider-participant-a",
              connectionRef:
                "connection-a",
            }),
          "23514",
          "ss_live_event_participant_shape_check",
        );

        /*
         * A room scoped event carrying neither field
         * remains the only legal ROOM_ENDED shape.
         */
        await insertEvent({
          id: "it_wave3_event_room_valid",
          providerEventRef:
            "provider-event-room-valid",
          type: "ROOM_ENDED",
          providerParticipantRef:
            null,
          connectionRef: null,
        });
      },
    );

    test(
      "participant events must carry both the participant and the connection",
      async () => {
        for (const type of [
          "PARTICIPANT_CONNECTED",
          "PARTICIPANT_DISCONNECTED",
        ] as const) {
          await expectPgFailure(
            () =>
              insertEvent({
                id: `it_wave3_event_${type}_no_participant`,
                providerEventRef: `provider-event-${type}-no-participant`,
                type,
                providerParticipantRef:
                  null,
                connectionRef:
                  "connection-a",
              }),
            "23514",
            "ss_live_event_participant_shape_check",
          );

          await expectPgFailure(
            () =>
              insertEvent({
                id: `it_wave3_event_${type}_no_connection`,
                providerEventRef: `provider-event-${type}-no-connection`,
                type,
                providerParticipantRef:
                  "provider-participant-a",
                connectionRef: null,
              }),
            "23514",
            "ss_live_event_participant_shape_check",
          );

          await expectPgFailure(
            () =>
              insertEvent({
                id: `it_wave3_event_${type}_no_fields`,
                providerEventRef: `provider-event-${type}-no-fields`,
                type,
                providerParticipantRef:
                  null,
                connectionRef: null,
              }),
            "23514",
            "ss_live_event_participant_shape_check",
          );
        }
      },
    );

    test(
      "blank participant and connection references are rejected on participant events",
      async () => {
        await expectPgFailure(
          () =>
            insertEvent({
              id: "it_wave3_event_blank_participant",
              providerEventRef:
                "provider-event-blank-participant",
              type:
                "PARTICIPANT_CONNECTED",
              providerParticipantRef:
                "",
              connectionRef:
                "connection-a",
            }),
          "23514",
          "ss_live_event_participant_shape_check",
        );

        await expectPgFailure(
          () =>
            insertEvent({
              id: "it_wave3_event_blank_connection",
              providerEventRef:
                "provider-event-blank-connection",
              type:
                "PARTICIPANT_CONNECTED",
              providerParticipantRef:
                "provider-participant-a",
              connectionRef: "   ",
            }),
          "23514",
          "ss_live_event_participant_shape_check",
        );

        await expectPgFailure(
          () =>
            insertEvent({
              id: "it_wave3_event_blank_event_ref",
              providerEventRef: "",
              type:
                "PARTICIPANT_CONNECTED",
              providerParticipantRef:
                "provider-participant-a",
              connectionRef:
                "connection-a",
            }),
          "23514",
          "ss_live_event_provider_event_format_check",
        );

        await expectPgFailure(
          () =>
            insertEvent({
              id: "it_wave3_event_padded_event_ref",
              providerEventRef:
                "  provider-event-padded  ",
              type:
                "PARTICIPANT_CONNECTED",
              providerParticipantRef:
                "provider-participant-a",
              connectionRef:
                "connection-a",
            }),
          "23514",
          "ss_live_event_provider_event_format_check",
        );
      },
    );

    test(
      "simultaneous connections under one provider participant stay separate rows",
      async () => {
        await insertEvent({
          id: "it_wave3_event_conn_a",
          providerEventRef:
            "provider-event-conn-a",
          type:
            "PARTICIPANT_CONNECTED",
          providerParticipantRef:
            "provider-participant-a",
          connectionRef:
            "connection-a",
        });

        await insertEvent({
          id: "it_wave3_event_conn_b",
          providerEventRef:
            "provider-event-conn-b",
          type:
            "PARTICIPANT_CONNECTED",
          providerParticipantRef:
            "provider-participant-a",
          connectionRef:
            "connection-b",
        });

        const count =
          await setupClient!.query<{
            count: number;
          }>(`
            SELECT COUNT(*)::int AS count
            FROM
              "speaking_session_live_event"
            WHERE
              "providerParticipantRef" =
                'provider-participant-a'
          `);

        expect(
          count.rows[0]?.count,
        ).toBe(2);
      },
    );

    /*
     * Each restrict assertion isolates a single
     * referencing row. A fixture carrying both a
     * grant and an event would leave which foreign
     * key reports first up to PostgreSQL, and the
     * pre-existing booking keys would mask the new
     * ones for a participant who also owns the
     * session.
     */
    test(
      "a live grant restricts deletion of its participant",
      async () => {
        await insertGrant({
          id: "it_wave3_grant_participant_history",
          participantUserId:
            IDS.otherStudentUser,
          participantRole: "STUDENT",
          clientJoinAttemptId:
            "attempt-history",
          providerParticipantRef:
            "provider-participant-history",
        });

        await expectPgFailure(
          () =>
            setupClient!.query(`
              DELETE FROM "user"
              WHERE "id" =
                '${IDS.otherStudentUser}'
            `),
          "23001",
          "speaking_session_live_grant_participantUserId_fkey",
        );
      },
    );

    test(
      "a live grant restricts deletion of its session",
      async () => {
        await insertGrant({
          id: "it_wave3_grant_session_history",
          participantUserId:
            IDS.otherStudentUser,
          participantRole: "STUDENT",
          clientJoinAttemptId:
            "attempt-session-history",
          providerParticipantRef:
            "provider-participant-session-history",
        });

        await expectPgFailure(
          () =>
            setupClient!.query(`
              DELETE FROM
                "speaking_session"
              WHERE "id" =
                '${IDS.session}'
            `),
          "23001",
          "speaking_session_live_grant_sessionId_fkey",
        );
      },
    );

    test(
      "recorded live evidence restricts deletion of its session",
      async () => {
        await insertEvent({
          id: "it_wave3_event_history",
          providerEventRef:
            "provider-event-history",
          type: "ROOM_ENDED",
        });

        await expectPgFailure(
          () =>
            setupClient!.query(`
              DELETE FROM
                "speaking_session"
              WHERE "id" =
                '${IDS.session}'
            `),
          "23001",
          "speaking_session_live_event_sessionId_fkey",
        );
      },
    );

    test(
      "the Wave 3 migration left the Wave 2 booking surface untouched",
      async () => {
        const columns =
          await setupClient!.query<{
            column_name: string;
            data_type: string;
            is_nullable: string;
          }>(`
            SELECT
              "column_name",
              "data_type",
              "is_nullable"
            FROM
              information_schema.columns
            WHERE
              "table_schema" = 'public'
              AND "table_name" =
                'speaking_session'
            ORDER BY
              "ordinal_position" ASC
          `);

        expect(
          columns.rows,
        ).toEqual([
          {
            column_name: "id",
            data_type: "text",
            is_nullable: "NO",
          },
          {
            column_name:
              "teacherProfileId",
            data_type: "text",
            is_nullable: "NO",
          },
          {
            column_name:
              "studentUserId",
            data_type: "text",
            is_nullable: "NO",
          },
          {
            column_name: "startAt",
            data_type:
              "timestamp with time zone",
            is_nullable: "NO",
          },
          {
            column_name: "endAt",
            data_type:
              "timestamp with time zone",
            is_nullable: "NO",
          },
          {
            column_name: "status",
            data_type:
              "USER-DEFINED",
            is_nullable: "NO",
          },
          {
            column_name:
              "bookingIdempotencyKey",
            data_type:
              "character varying",
            is_nullable: "NO",
          },
          {
            column_name: "createdAt",
            data_type:
              "timestamp with time zone",
            is_nullable: "NO",
          },
          {
            column_name: "updatedAt",
            data_type:
              "timestamp with time zone",
            is_nullable: "NO",
          },
        ]);

        /*
         * These guards predate Wave 3 and are only
         * consumed by it. A partial unique index is
         * not a pg_constraint row, so presence must
         * be checked against both catalogs.
         */
        const guards =
          await setupClient!.query<{
            expected: string;
            present: boolean;
          }>(
            `
              SELECT
                n AS expected,
                (
                  EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = n
                  )
                  OR EXISTS (
                    SELECT 1
                    FROM pg_class c
                    JOIN pg_namespace ns
                      ON ns.oid =
                        c.relnamespace
                    WHERE
                      c.relname = n
                      AND c.relkind = 'i'
                      AND ns.nspname =
                        'public'
                  )
                ) AS present
              FROM
                unnest($1::text[]) AS n
              ORDER BY n ASC
            `,
            [
              [
                "speaking_session_exact_15m_check",
                "speaking_session_start_grid_check",
                "speaking_session_teacher_active_slot_key",
                "speaking_session_student_active_slot_key",
                "tar_no_active_overlap",
              ],
            ],
          );

        expect(
          guards.rows,
        ).toEqual([
          {
            expected:
              "speaking_session_exact_15m_check",
            present: true,
          },
          {
            expected:
              "speaking_session_start_grid_check",
            present: true,
          },
          {
            expected:
              "speaking_session_student_active_slot_key",
            present: true,
          },
          {
            expected:
              "speaking_session_teacher_active_slot_key",
            present: true,
          },
          {
            expected:
              "tar_no_active_overlap",
            present: true,
          },
        ]);
      },
    );

    test(
      "the hand-written event shape constraint is still installed",
      async () => {
        /*
         * prisma migrate diff cannot detect the loss
         * of a hand-written CHECK, so its existence
         * is asserted directly rather than inferred
         * from schema drift.
         */
        const constraints =
          await setupClient!.query<{
            conname: string;
          }>(`
            SELECT "conname"
            FROM pg_constraint
            WHERE
              "contype" = 'c'
              AND "conrelid" IN (
                'public.speaking_session_live_event'
                  ::regclass,
                'public.speaking_session_live_grant'
                  ::regclass
              )
            ORDER BY "conname" ASC
          `);

        expect(
          constraints.rows.map(
            (row) => row.conname,
          ),
        ).toEqual([
          "ss_live_event_participant_shape_check",
          "ss_live_event_provider_event_format_check",
          "ss_live_grant_join_attempt_format_check",
          "ss_live_grant_provider_participant_format_check",
        ]);
      },
    );
  },
);
