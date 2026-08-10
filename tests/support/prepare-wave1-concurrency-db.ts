import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";

import {
  getTestDatabaseUrl,
} from "./test-database-url";

const PRE_WAVE1_MIGRATIONS = [
  "20260803175553_add_better_auth_core",
  "20260803190451_add_role_onboarding",
  "20260806071927_add_profile_completion_fields",
  "20260806080348_add_native_language_and_timezone_enums",
  "20260806104658_add_teacher_application_and_intro_video",
] as const;

const WAVE1_MIGRATION =
  "20260808120000_add_admin_review_foundation";

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
    row?.database_name === "takineo_test" &&
      row.user_name === "takineo_test" &&
      row.server_address === "127.0.0.1" &&
      row.server_port === 5432,
    "Refusing destructive concurrency preparation: unexpected database identity.",
  );

  console.log(
    "Verified isolated takineo_test database.",
  );
}

async function resetSchema(
  client: Client,
): Promise<void> {
  await client.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public AUTHORIZATION takineo_test;
  `);

  console.log(
    "Reset disposable public schema.",
  );
}

async function readMigration(
  migration: string,
): Promise<string> {
  return readFile(
    resolve(
      process.cwd(),
      "prisma",
      "migrations",
      migration,
      "migration.sql",
    ),
    "utf8",
  );
}

async function applyPreWave1(
  client: Client,
): Promise<void> {
  for (const migration of PRE_WAVE1_MIGRATIONS) {
    const sql =
      await readMigration(migration);

    await client.query("BEGIN");

    try {
      await client.query(sql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    console.log(
      `Applied ${migration}.`,
    );
  }
}

async function applyWave1(
  client: Client,
): Promise<void> {
  const sql =
    await readMigration(
      WAVE1_MIGRATION,
    );

  try {
    /*
     * Wave 1 contains its own explicit
     * BEGIN / COMMIT transaction.
     */
    await client.query(sql);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve original migration failure.
    }

    throw error;
  }

  console.log(
    `Applied ${WAVE1_MIGRATION}.`,
  );
}

async function verifyWave1Schema(
  client: Client,
): Promise<void> {
  const result = await client.query<{
    legacy_playback: boolean;
    public_playback: boolean;
    account_status: boolean;
    review_cycle: boolean;
    admin_access: boolean;
    admin_audit: boolean;
    reconciliation: boolean;
  }>(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teacher_intro_video'
          AND column_name = 'playbackId'
      ) AS legacy_playback,

      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teacher_intro_video'
          AND column_name = 'publicPlaybackId'
      ) AS public_playback,

      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user'
          AND column_name = 'accountStatus'
      ) AS account_status,

      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teacher_profile'
          AND column_name = 'reviewCycle'
      ) AS review_cycle,

      to_regclass('public.admin_access') IS NOT NULL
        AS admin_access,

      to_regclass('public.admin_audit_event') IS NOT NULL
        AS admin_audit,

      to_regclass('public.mux_playback_reconciliation') IS NOT NULL
        AS reconciliation
  `);

  const schema = result.rows[0];

  assert(
    schema &&
      !schema.legacy_playback &&
      schema.public_playback &&
      schema.account_status &&
      schema.review_cycle &&
      schema.admin_access &&
      schema.admin_audit &&
      schema.reconciliation,
    "Concurrency database is not at the expected Wave 1 schema.",
  );

  const counts = await client.query<{
    users: number;
    profiles: number;
    videos: number;
    reconciliations: number;
  }>(`
    SELECT
      (SELECT COUNT(*)::int
       FROM "user") AS users,

      (SELECT COUNT(*)::int
       FROM "teacher_profile")
        AS profiles,

      (SELECT COUNT(*)::int
       FROM "teacher_intro_video")
        AS videos,

      (SELECT COUNT(*)::int
       FROM "mux_playback_reconciliation")
        AS reconciliations
  `);

  const row = counts.rows[0];

  assert(
    row?.users === 0 &&
      row.profiles === 0 &&
      row.videos === 0 &&
      row.reconciliations === 0,
    "Expected a clean empty Wave 1 concurrency database.",
  );

  console.log(
    "Verified clean empty Wave 1 schema.",
  );
}

async function main() {
  const client = new Client({
    connectionString:
      getTestDatabaseUrl(),
    application_name:
      "takineo-wave1-concurrency-preparation",
  });

  await client.connect();

  try {
    await verifyIdentity(client);
    await resetSchema(client);
    await applyPreWave1(client);
    await applyWave1(client);
    await verifyWave1Schema(client);

    console.log(
      "Wave 1 concurrency database is ready.",
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Wave 1 concurrency database preparation failed.",
  );

  if (error instanceof Error) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
