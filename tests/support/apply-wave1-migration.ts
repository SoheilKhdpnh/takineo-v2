import "dotenv/config";

import {
  readFile,
} from "node:fs/promises";
import {
  resolve,
} from "node:path";

import {
  Client,
} from "pg";

import {
  getTestDatabaseUrl,
} from "./test-database-url";

const EXPECTED_DATABASE = "takineo_test";
const EXPECTED_USER = "takineo_test";
const EXPECTED_HOST = "127.0.0.1";
const EXPECTED_PORT = 5432;

const WAVE1_MIGRATION =
  "20260808120000_add_admin_review_foundation";

async function verifyDatabaseIdentity(
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

  const identity = result.rows[0];

  if (
    !identity ||
    identity.database_name !== EXPECTED_DATABASE ||
    identity.user_name !== EXPECTED_USER ||
    identity.server_address !== EXPECTED_HOST ||
    identity.server_port !== EXPECTED_PORT
  ) {
    throw new Error(
      "Refusing Wave 1 migration: database identity does not match isolated takineo_test.",
    );
  }
}

async function verifyPreWave1Boundary(
  client: Client,
): Promise<void> {
  const result = await client.query<{
    has_legacy_playback_id: boolean;
    has_public_playback_id: boolean;
    has_account_status: boolean;
    has_review_cycle: boolean;
    has_admin_access: boolean;
    has_mux_reconciliation: boolean;
  }>(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teacher_intro_video'
          AND column_name = 'playbackId'
      ) AS has_legacy_playback_id,

      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teacher_intro_video'
          AND column_name = 'publicPlaybackId'
      ) AS has_public_playback_id,

      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user'
          AND column_name = 'accountStatus'
      ) AS has_account_status,

      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teacher_profile'
          AND column_name = 'reviewCycle'
      ) AS has_review_cycle,

      to_regclass('public.admin_access') IS NOT NULL
        AS has_admin_access,

      to_regclass('public.mux_playback_reconciliation') IS NOT NULL
        AS has_mux_reconciliation
  `);

  const schema = result.rows[0];

  if (
    !schema ||
    !schema.has_legacy_playback_id ||
    schema.has_public_playback_id ||
    schema.has_account_status ||
    schema.has_review_cycle ||
    schema.has_admin_access ||
    schema.has_mux_reconciliation
  ) {
    throw new Error(
      "Refusing Wave 1 migration: database is not at the exact pre-Wave1 schema boundary.",
    );
  }
}

async function verifySeedFixtures(
  client: Client,
): Promise<void> {
  const counts = await client.query<{
    users: number;
    profiles: number;
    videos: number;
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM "user") AS users,
      (SELECT COUNT(*)::int FROM "teacher_profile") AS profiles,
      (SELECT COUNT(*)::int FROM "teacher_intro_video") AS videos
  `);

  const count = counts.rows[0];

  if (
    !count ||
    count.users !== 7 ||
    count.profiles !== 7 ||
    count.videos !== 7
  ) {
    throw new Error(
      "Refusing Wave 1 migration: expected exactly 7 seeded legacy users, profiles, and videos.",
    );
  }

  const fixtures = await client.query<{
    id: string;
  }>(`
    SELECT "id"
    FROM "teacher_profile"
    WHERE "id" IN (
      'tp_draft_public',
      'tp_rejected_bad_video',
      'tp_pending_good',
      'tp_pending_bad',
      'tp_approved_good',
      'tp_approved_profile_bad',
      'tp_suspended_good'
    )
    ORDER BY "id"
  `);

  if (fixtures.rows.length !== 7) {
    throw new Error(
      "Refusing Wave 1 migration: deterministic legacy fixture set is incomplete.",
    );
  }
}

async function applyWave1Migration(
  client: Client,
): Promise<void> {
  const migrationPath = resolve(
    process.cwd(),
    "prisma",
    "migrations",
    WAVE1_MIGRATION,
    "migration.sql",
  );

  const sql = await readFile(
    migrationPath,
    "utf8",
  );

  console.log(
    `Applying ${WAVE1_MIGRATION}...`,
  );

  try {
    await client.query(sql);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original migration failure.
    }

    throw error;
  }
}

async function verifyWave1Committed(
  client: Client,
): Promise<void> {
  const result = await client.query<{
    has_legacy_playback_id: boolean;
    has_public_playback_id: boolean;
    has_account_status: boolean;
    has_review_cycle: boolean;
    has_admin_access: boolean;
    has_admin_audit_event: boolean;
    has_mux_reconciliation: boolean;
  }>(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teacher_intro_video'
          AND column_name = 'playbackId'
      ) AS has_legacy_playback_id,

      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teacher_intro_video'
          AND column_name = 'publicPlaybackId'
      ) AS has_public_playback_id,

      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user'
          AND column_name = 'accountStatus'
      ) AS has_account_status,

      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teacher_profile'
          AND column_name = 'reviewCycle'
      ) AS has_review_cycle,

      to_regclass('public.admin_access') IS NOT NULL
        AS has_admin_access,

      to_regclass('public.admin_audit_event') IS NOT NULL
        AS has_admin_audit_event,

      to_regclass('public.mux_playback_reconciliation') IS NOT NULL
        AS has_mux_reconciliation
  `);

  const schema = result.rows[0];

  if (
    !schema ||
    schema.has_legacy_playback_id ||
    !schema.has_public_playback_id ||
    !schema.has_account_status ||
    !schema.has_review_cycle ||
    !schema.has_admin_access ||
    !schema.has_admin_audit_event ||
    !schema.has_mux_reconciliation
  ) {
    throw new Error(
      "Wave 1 migration execution returned successfully, but the expected Wave 1 schema was not committed.",
    );
  }

  const counts = await client.query<{
    users: number;
    profiles: number;
    videos: number;
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM "user") AS users,
      (SELECT COUNT(*)::int FROM "teacher_profile") AS profiles,
      (SELECT COUNT(*)::int FROM "teacher_intro_video") AS videos
  `);

  const count = counts.rows[0];

  if (
    !count ||
    count.users !== 7 ||
    count.profiles !== 7 ||
    count.videos !== 7
  ) {
    throw new Error(
      "Wave 1 migration changed the number of seeded legacy users, profiles, or videos.",
    );
  }
}

async function main() {
  const client = new Client({
    connectionString:
      getTestDatabaseUrl(),
    application_name:
      "takineo-wave1-migration-test",
  });

  await client.connect();

  try {
    await verifyDatabaseIdentity(client);
    await verifyPreWave1Boundary(client);
    await verifySeedFixtures(client);

    console.log(
      "Verified exact seeded pre-Wave1 migration boundary.",
    );

    await applyWave1Migration(client);

    await verifyWave1Committed(client);

    console.log(
      "Wave 1 migration committed successfully on isolated test PostgreSQL.",
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Wave 1 migration test execution failed.",
  );

  if (error instanceof Error) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
