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
) {
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
    "Refusing destructive rollback test: unexpected database identity.",
  );

  console.log(
    "Verified isolated takineo_test database.",
  );
}

async function resetDatabase(
  client: Client,
) {
  await client.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public AUTHORIZATION takineo_test;
  `);

  console.log(
    "Reset disposable public schema.",
  );
}

async function applyPreWave1(
  client: Client,
) {
  for (const migration of PRE_WAVE1_MIGRATIONS) {
    const sql = await readFile(
      resolve(
        process.cwd(),
        "prisma",
        "migrations",
        migration,
        "migration.sql",
      ),
      "utf8",
    );

    await client.query("BEGIN");

    try {
      await client.query(sql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  console.log(
    "Rebuilt exact pre-Wave1 schema.",
  );
}

async function seedUnsafeLegacyRow(
  client: Client,
) {
  await client.query(`
    INSERT INTO "user" (
      "id",
      "name",
      "email",
      "emailVerified",
      "createdAt",
      "updatedAt",
      "role",
      "onboardingCompletedAt"
    )
    VALUES (
      'u_rollback_guard',
      'Rollback Guard',
      'rollback-guard@example.test',
      true,
      '2026-08-01T08:00:00Z',
      '2026-08-01T08:00:00Z',
      'TEACHER',
      '2026-08-01T08:30:00Z'
    );

    INSERT INTO "teacher_profile" (
      "id",
      "userId",
      "createdAt",
      "updatedAt",
      "bio",
      "experienceYears",
      "headline",
      "nativeLanguage",
      "profileCompletedAt",
      "teachingLanguage",
      "timezone",
      "applicationStatus",
      "applicationSubmittedAt",
      "applicationReviewedAt",
      "applicationReviewNote"
    )
    VALUES (
      'tp_rollback_guard',
      'u_rollback_guard',
      '2026-08-01T09:00:00Z',
      '2026-08-01T09:00:00Z',
      'Rollback migration fixture.',
      4,
      'Rollback teacher',
      'fa',
      '2026-08-01T10:00:00Z',
      'en',
      'Asia/Tehran',
      'DRAFT',
      NULL,
      NULL,
      'rollback legacy note'
    );

    INSERT INTO "teacher_intro_video" (
      "id",
      "teacherProfileId",
      "provider",
      "uploadId",
      "assetId",
      "playbackId",
      "status",
      "durationSeconds",
      "rejectionReason",
      "submittedAt",
      "reviewedAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      'v_rollback_guard',
      'tp_rollback_guard',
      'vimeo',
      'upload_rollback_guard',
      'asset_rollback_guard',
      'public_rollback_guard',
      'APPROVED',
      90,
      NULL,
      '2026-08-02T09:00:00Z',
      '2026-08-03T09:00:00Z',
      '2026-08-01T09:00:00Z',
      '2026-08-03T09:00:00Z'
    );
  `);

  console.log(
    "Seeded intentionally unsafe legacy public-playback fixture.",
  );
}

async function expectWave1Failure(
  client: Client,
) {
  const sql = await readFile(
    resolve(
      process.cwd(),
      "prisma",
      "migrations",
      WAVE1_MIGRATION,
      "migration.sql",
    ),
    "utf8",
  );

  let expectedFailure = false;

  try {
    await client.query(sql);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes(
        "Cannot migrate legacy public playback with unsupported or invalid Mux provider identity",
      )
    ) {
      expectedFailure = true;
    }

    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original migration result.
    }

    if (!expectedFailure) {
      throw error;
    }
  }

  assert(
    expectedFailure,
    "Wave 1 unexpectedly accepted unsafe legacy public playback evidence.",
  );

  console.log(
    "Wave 1 correctly rejected unsafe legacy public playback evidence.",
  );
}

async function verifyCompleteRollback(
  client: Client,
) {
  const schema = await client.query<{
    playback_id: boolean;
    public_playback_id: boolean;
    account_status: boolean;
    review_cycle: boolean;
    legacy_video_status: boolean;
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
      ) AS playback_id,

      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teacher_intro_video'
          AND column_name = 'publicPlaybackId'
      ) AS public_playback_id,

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

      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teacher_intro_video'
          AND column_name = 'legacyStatus'
      ) AS legacy_video_status,

      to_regclass('public.admin_access') IS NOT NULL
        AS admin_access,

      to_regclass('public.admin_audit_event') IS NOT NULL
        AS admin_audit,

      to_regclass('public.mux_playback_reconciliation') IS NOT NULL
        AS reconciliation
  `);

  const row = schema.rows[0];

  assert(
    row &&
      row.playback_id &&
      !row.public_playback_id &&
      !row.account_status &&
      !row.review_cycle &&
      !row.legacy_video_status &&
      !row.admin_access &&
      !row.admin_audit &&
      !row.reconciliation,
    "Wave 1 schema changes were not fully rolled back.",
  );

  const types = await client.query<{
    count: number;
  }>(`
    SELECT COUNT(*)::int AS count
    FROM pg_type
    WHERE typname IN (
      'AccountStatus',
      'AdminPermission',
      'AdminAuditAction',
      'ReviewRejectionTarget',
      'PlaybackDesiredState',
      'PlaybackReconciliationStatus'
    )
  `);

  assert(
    types.rows[0]?.count === 0,
    "Wave 1 enum types survived the rollback.",
  );

  const functionCheck =
    await client.query<{
      exists: boolean;
    }>(`
      SELECT
        to_regprocedure(
          'prevent_admin_audit_mutation()'
        ) IS NOT NULL AS exists
    `);

  assert(
    functionCheck.rows[0]?.exists === false,
    "Wave 1 audit trigger function survived the rollback.",
  );

  const fixture = await client.query<{
    applicationStatus: string;
    applicationReviewNote: string | null;
    provider: string;
    uploadId: string | null;
    assetId: string | null;
    playbackId: string | null;
    status: string;
    durationSeconds: number | null;
  }>(`
    SELECT
      tp."applicationStatus",
      tp."applicationReviewNote",
      tiv."provider",
      tiv."uploadId",
      tiv."assetId",
      tiv."playbackId",
      tiv."status",
      tiv."durationSeconds"
    FROM "teacher_profile" tp
    JOIN "teacher_intro_video" tiv
      ON tiv."teacherProfileId" = tp."id"
    WHERE tp."id" = 'tp_rollback_guard'
  `);

  const legacy = fixture.rows[0];

  assert(
    legacy?.applicationStatus === "DRAFT" &&
      legacy.applicationReviewNote ===
        "rollback legacy note" &&
      legacy.provider === "vimeo" &&
      legacy.uploadId ===
        "upload_rollback_guard" &&
      legacy.assetId ===
        "asset_rollback_guard" &&
      legacy.playbackId ===
        "public_rollback_guard" &&
      legacy.status === "APPROVED" &&
      legacy.durationSeconds === 90,
    "Legacy fixture data changed despite migration rollback.",
  );

  console.log(
    "Verified complete transactional rollback of Wave 1 schema and data changes.",
  );
}

async function main() {
  const client = new Client({
    connectionString:
      getTestDatabaseUrl(),
    application_name:
      "takineo-wave1-rollback-verifier",
  });

  await client.connect();

  try {
    await verifyIdentity(client);
    await resetDatabase(client);
    await applyPreWave1(client);
    await seedUnsafeLegacyRow(client);
    await expectWave1Failure(client);
    await verifyCompleteRollback(client);

    console.log(
      "Wave 1 rollback / atomicity path passed.",
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Wave 1 rollback verification failed.",
  );

  if (error instanceof Error) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
