import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Client } from "pg";

import { getTestDatabaseUrl } from "./test-database-url";

const MIGRATION_NAME = "20260913090000_add_session_analysis_foundation";
const WAVE4_TABLES = [
  "speaking_session_audio_artifact",
  "speaking_session_analysis_run",
  "speaking_session_transcript",
  "speaking_session_analysis_report",
  "speaking_session_fluency_profile",
  "speaking_session_correction",
  "speaking_session_vocabulary_observation",
  "speaking_session_vocabulary_alternative",
  "speaking_session_weak_point",
  "speaking_session_suggestion",
  "speaking_session_teacher_feedback",
] as const;

const BOOKING_GUARDS = [
  "speaking_session_exact_15m_check",
  "speaking_session_start_grid_check",
  "tar_no_active_overlap",
] as const;

const BOOKING_INDEXES = [
  "speaking_session_teacher_active_slot_key",
  "speaking_session_student_active_slot_key",
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function verifyIdentity(client: Client) {
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
    row?.database_name === "takineo_test" &&
      row.user_name === "takineo_test" &&
      row.server_address === "127.0.0.1" &&
      row.server_port === 5432,
    "Refusing Wave 4 migration: unexpected database identity.",
  );
}

async function main() {
  const url = getTestDatabaseUrl({
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  });

  const migrationPath = resolve(
    process.cwd(),
    "prisma/migrations",
    MIGRATION_NAME,
    "migration.sql",
  );
  const sql = (await readFile(migrationPath, "utf8")).replace(/^\uFEFF/, "");
  const checksum = createHash("sha256").update(sql).digest("hex");

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await verifyIdentity(client);
    console.log("identity: takineo_test@127.0.0.1:5432/takineo_test");

    const sessionColumns = await client.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'speaking_session'
      ORDER BY ordinal_position
    `);
    console.log(
      "speaking_session columns:",
      sessionColumns.rows.map((row) => row.column_name).join(","),
    );
    assert(sessionColumns.rows.length === 9, "speaking_session column count drifted.");

    const existing = await client.query<{ migration_name: string }>(`
      SELECT migration_name
      FROM _prisma_migrations
      ORDER BY started_at
    `);
    console.log(
      "applied migrations:",
      existing.rows.map((row) => row.migration_name).join("\n  "),
    );

    const alreadyApplied = existing.rows.some(
      (row) => row.migration_name === MIGRATION_NAME,
    );
    const tablesBefore = await client.query<{ n: string }>(
      `
        SELECT tablename AS n
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = ANY($1::text[])
      `,
      [WAVE4_TABLES],
    );

    if (alreadyApplied && tablesBefore.rows.length === WAVE4_TABLES.length) {
      console.log("Wave 4 analysis migration already applied.");
    } else if (tablesBefore.rows.length === WAVE4_TABLES.length && !alreadyApplied) {
      await client.query(
        `
          INSERT INTO _prisma_migrations (
            id, checksum, finished_at, migration_name,
            logs, rolled_back_at, started_at, applied_steps_count
          )
          VALUES (
            gen_random_uuid()::text, $1, NOW(), $2,
            NULL, NULL, NOW(), 1
          )
        `,
        [checksum, MIGRATION_NAME],
      );
      console.log("recorded already-applied SQL as:", MIGRATION_NAME);
    } else {
      assert(
        tablesBefore.rows.length === 0,
        "Wave 4 tables are only partially present.",
      );
      await client.query(sql);
      await client.query(
        `
          INSERT INTO _prisma_migrations (
            id, checksum, finished_at, migration_name,
            logs, rolled_back_at, started_at, applied_steps_count
          )
          VALUES (
            gen_random_uuid()::text, $1, NOW(), $2,
            NULL, NULL, NOW(), 1
          )
        `,
        [checksum, MIGRATION_NAME],
      );
      console.log("applied:", MIGRATION_NAME);
    }

    const tablesAfter = await client.query<{ n: string }>(
      `
        SELECT tablename AS n
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = ANY($1::text[])
        ORDER BY tablename
      `,
      [WAVE4_TABLES],
    );
    assert(
      tablesAfter.rows.length === WAVE4_TABLES.length,
      `expected ${WAVE4_TABLES.length} Wave 4 tables, found ${tablesAfter.rows.length}`,
    );

    const sessionColumnsAfter = await client.query<{ count: string }>(`
      SELECT count(*)::text AS count
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'speaking_session'
    `);
    assert(sessionColumnsAfter.rows[0]?.count === "9", "speaking_session gained or lost columns.");

    const guards = await client.query<{ n: string }>(
      `
        SELECT conname AS n
        FROM pg_constraint
        WHERE conname = ANY($1::text[])
      `,
      [BOOKING_GUARDS],
    );
    assert(
      guards.rows.length === BOOKING_GUARDS.length,
      "Wave 2 booking CHECK/exclusion guards missing after Wave 4 apply.",
    );

    const indexes = await client.query<{ n: string }>(
      `
        SELECT relname AS n
        FROM pg_class
        WHERE relname = ANY($1::text[])
      `,
      [BOOKING_INDEXES],
    );
    assert(
      indexes.rows.length === BOOKING_INDEXES.length,
      "Wave 2 active-slot indexes missing after Wave 4 apply.",
    );

    const wave4Constraints = await client.query<{ n: string }>(`
      SELECT conname AS n
      FROM pg_constraint
      WHERE conname LIKE 'ss_%'
      ORDER BY conname
    `);
    const inFlight = await client.query<{ n: string }>(`
      SELECT indexname AS n
      FROM pg_indexes
      WHERE indexname = 'ss_analysis_run_active_session_key'
    `);
    assert(
      inFlight.rows.length === 1,
      "ss_analysis_run_active_session_key was not installed.",
    );

    const pairing = await client.query<{ n: string }>(`
      SELECT conname AS n
      FROM pg_constraint
      WHERE conname IN (
        'ss_analysis_run_student_artifact_pair_fk',
        'ss_analysis_run_teacher_artifact_pair_fk'
      )
    `);
    assert(pairing.rows.length === 2, "composite pairing foreign keys missing.");

    const liveTables = await client.query<{ n: string }>(`
      SELECT tablename AS n
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN (
          'speaking_session_live_grant',
          'speaking_session_live_event'
        )
      ORDER BY tablename
    `);

    console.log("wave4 tables:", tablesAfter.rows.map((row) => row.n).join(","));
    console.log("wave4 ss_* constraints:", wave4Constraints.rows.length);
    console.log(
      "wave3 live tables present:",
      liveTables.rows.map((row) => row.n).join(",") || "(none in this worktree baseline)",
    );
    console.log("booking guards intact: yes");
    console.log("M2 apply verification: PASS");
  } finally {
    await client.end();
  }
}

await main();
