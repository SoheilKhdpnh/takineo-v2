import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";

import {
  getTestDatabaseUrl,
} from "./test-database-url";

const EXPECTED_DATABASE = "takineo_test";
const EXPECTED_USER = "takineo_test";
const EXPECTED_HOST = "127.0.0.1";
const EXPECTED_PORT = 5432;

const WAVE2_MIGRATION =
  "20260810124000_add_booking_foundation";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function verifyIdentity(
  client: Client,
): Promise<void> {
  const result = await client.query<{
    database_name: string;
    user_name: string;
    server_address: string;
    server_port: number;
  }>(`
    SELECT
      current_database()::text AS database_name,
      current_user::text AS user_name,
      host(inet_server_addr())::text AS server_address,
      inet_server_port()::int AS server_port
  `);

  const row = result.rows[0];

  assert(
    row?.database_name === EXPECTED_DATABASE &&
      row.user_name === EXPECTED_USER &&
      row.server_address === EXPECTED_HOST &&
      row.server_port === EXPECTED_PORT,
    "Refusing Wave 2 migration: unexpected database identity.",
  );

  console.log(
    "Verified isolated takineo_test database.",
  );
}

async function verifyWave1Boundary(
  client: Client,
): Promise<void> {
  const result = await client.query<{
    account_status: boolean;
    admin_access: boolean;
    reconciliation: boolean;

    availability_rule: boolean;
    availability_exception: boolean;
    speaking_session: boolean;
    cancellation: boolean;
  }>(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user'
          AND column_name = 'accountStatus'
      ) AS account_status,

      to_regclass(
        'public.admin_access'
      ) IS NOT NULL AS admin_access,

      to_regclass(
        'public.mux_playback_reconciliation'
      ) IS NOT NULL AS reconciliation,

      to_regclass(
        'public.teacher_availability_rule'
      ) IS NOT NULL AS availability_rule,

      to_regclass(
        'public.teacher_availability_exception'
      ) IS NOT NULL AS availability_exception,

      to_regclass(
        'public.speaking_session'
      ) IS NOT NULL AS speaking_session,

      to_regclass(
        'public.speaking_session_cancellation'
      ) IS NOT NULL AS cancellation
  `);

  const row = result.rows[0];

  assert(
    row &&
      row.account_status &&
      row.admin_access &&
      row.reconciliation &&
      !row.availability_rule &&
      !row.availability_exception &&
      !row.speaking_session &&
      !row.cancellation,
    "Refusing Wave 2 migration: database is not at the expected Wave 1 boundary.",
  );

  console.log(
    "Verified exact pre-Wave2 schema boundary.",
  );
}

async function applyMigration(
  client: Client,
): Promise<void> {
  const path = resolve(
    process.cwd(),
    "prisma",
    "migrations",
    WAVE2_MIGRATION,
    "migration.sql",
  );

  const sql = await readFile(
    path,
    "utf8",
  );

  console.log(
    `Applying ${WAVE2_MIGRATION}...`,
  );

  try {
    /*
     * Migration owns its own
     * BEGIN / COMMIT transaction.
     */
    await client.query(sql);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve original migration error.
    }

    throw error;
  }
}

async function verifyCommittedSchema(
  client: Client,
): Promise<void> {
  const tables = await client.query<{
    availability_rule: boolean;
    availability_exception: boolean;
    speaking_session: boolean;
    cancellation: boolean;
  }>(`
    SELECT
      to_regclass(
        'public.teacher_availability_rule'
      ) IS NOT NULL AS availability_rule,

      to_regclass(
        'public.teacher_availability_exception'
      ) IS NOT NULL AS availability_exception,

      to_regclass(
        'public.speaking_session'
      ) IS NOT NULL AS speaking_session,

      to_regclass(
        'public.speaking_session_cancellation'
      ) IS NOT NULL AS cancellation
  `);

  const tableState =
    tables.rows[0];

  assert(
    tableState?.availability_rule &&
      tableState.availability_exception &&
      tableState.speaking_session &&
      tableState.cancellation,
    "Wave 2 tables were not committed.",
  );

  const enums = await client.query<{
    count: number;
  }>(`
    SELECT COUNT(*)::int AS count
    FROM pg_type
    WHERE typname IN (
      'Weekday',
      'AvailabilityExceptionType',
      'SpeakingSessionStatus',
      'SpeakingSessionCancellationActor'
    )
  `);

  assert(
    enums.rows[0]?.count === 4,
    "Expected all four Wave 2 enum types.",
  );

  const extension =
    await client.query<{
      exists: boolean;
    }>(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'btree_gist'
      ) AS exists
    `);

  assert(
    extension.rows[0]?.exists === true,
    "btree_gist extension was not installed.",
  );
}

async function verifyCriticalConstraints(
  client: Client,
): Promise<void> {
  const expectedConstraints = [
    "tar_minute_window_check",
    "tae_minute_window_check",
    "tae_note_check",
    "speaking_session_exact_15m_check",
    "speaking_session_start_grid_check",
    "speaking_session_idempotency_key_check",
    "session_cancellation_actor_user_check",
    "session_cancellation_reason_check",
    "tar_no_active_overlap",
    "tae_no_overlap",
  ];

  const constraints =
    await client.query<{
      conname: string;
    }>(
      `
        SELECT conname
        FROM pg_constraint
        WHERE conname = ANY($1::text[])
      `,
      [
        expectedConstraints,
      ],
    );

  const found =
    new Set(
      constraints.rows.map(
        (row) => row.conname,
      ),
    );

  for (
    const constraint
    of expectedConstraints
  ) {
    assert(
      found.has(constraint),
      `Missing Wave 2 constraint: ${constraint}.`,
    );
  }

  const expectedIndexes = [
    "tar_exact_window_key",
    "tar_teacher_day_lookup_idx",
    "tar_discovery_lookup_idx",
    "tae_exact_window_key",
    "tae_teacher_date_lookup_idx",
    "tae_date_type_lookup_idx",
    "speaking_session_student_idempotency_key",
    "speaking_session_teacher_status_start_idx",
    "speaking_session_student_status_start_idx",
    "speaking_session_status_start_idx",
    "speaking_session_teacher_active_slot_key",
    "speaking_session_student_active_slot_key",
    "speaking_session_cancellation_sessionId_key",
    "session_cancellation_actor_time_idx",
  ];

  const indexes =
    await client.query<{
      indexname: string;
    }>(
      `
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = ANY($1::text[])
      `,
      [
        expectedIndexes,
      ],
    );

  const foundIndexes =
    new Set(
      indexes.rows.map(
        (row) => row.indexname,
      ),
    );

  for (
    const index
    of expectedIndexes
  ) {
    assert(
      foundIndexes.has(index),
      `Missing Wave 2 index: ${index}.`,
    );
  }

  console.log(
    "Verified Wave 2 tables, enums, extension, constraints, and indexes.",
  );
}

async function main() {
  const client = new Client({
    connectionString:
      getTestDatabaseUrl(),
    application_name:
      "takineo-wave2-booking-migration-test",
  });

  await client.connect();

  try {
    await verifyIdentity(client);
    await verifyWave1Boundary(client);
    await applyMigration(client);
    await verifyCommittedSchema(client);
    await verifyCriticalConstraints(client);

    console.log(
      "Wave 2 booking migration committed successfully on isolated PostgreSQL.",
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Wave 2 booking migration verification failed.",
  );

  if (error instanceof Error) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
