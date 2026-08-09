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

const PRE_WAVE1_MIGRATIONS = [
  "20260803175553_add_better_auth_core",
  "20260803190451_add_role_onboarding",
  "20260806071927_add_profile_completion_fields",
  "20260806080348_add_native_language_and_timezone_enums",
  "20260806104658_add_teacher_application_and_intro_video",
] as const;

const EXPECTED_DATABASE = "takineo_test";
const EXPECTED_USER = "takineo_test";
const EXPECTED_HOST = "127.0.0.1";
const EXPECTED_PORT = 5432;

type IdentityRow = {
  database_name: string;
  user_name: string;
  server_address: string;
  server_port: number;
};

async function verifyIdentity(
  client: Client,
): Promise<void> {
  const result =
    await client.query<IdentityRow>(`
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
      "Refusing destructive test setup: database identity does not match the isolated local Takineo test database.",
    );
  }

  console.log(
    `Verified isolated database: ${identity.database_name} as ${identity.user_name} on ${identity.server_address}:${identity.server_port}`,
  );
}

async function verifyDatabaseIsEmpty(
  client: Client,
): Promise<void> {
  const result = await client.query<{
    table_name: string;
  }>(`
    SELECT tablename::text AS table_name
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  if (result.rows.length !== 0) {
    throw new Error(
      `Refusing destructive test setup: public schema is not empty (${result.rows
        .map((row) => row.table_name)
        .join(", ")}).`,
    );
  }

  console.log(
    "Verified public schema is empty.",
  );
}

async function applyMigration(
  client: Client,
  migrationName: string,
): Promise<void> {
  const migrationPath = resolve(
    process.cwd(),
    "prisma",
    "migrations",
    migrationName,
    "migration.sql",
  );

  const sql =
    await readFile(
      migrationPath,
      "utf8",
    );

  console.log(
    `Applying ${migrationName}...`,
  );

  await client.query("BEGIN");

  try {
    await client.query(sql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  console.log(
    `Applied ${migrationName}.`,
  );
}

async function verifyPreWave1Schema(
  client: Client,
): Promise<void> {
  const tables = await client.query<{
    table_name: string;
  }>(`
    SELECT tablename::text AS table_name
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  const tableNames = new Set(
    tables.rows.map(
      (row) => row.table_name,
    ),
  );

  for (const requiredTable of [
    "user",
    "student_profile",
    "teacher_profile",
    "teacher_intro_video",
  ]) {
    if (!tableNames.has(requiredTable)) {
      throw new Error(
        `Pre-Wave1 verification failed: missing table ${requiredTable}.`,
      );
    }
  }

  const columns = await client.query<{
    table_name: string;
    column_name: string;
  }>(`
    SELECT
      table_name::text,
      column_name::text
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'user',
        'teacher_profile',
        'teacher_intro_video'
      )
  `);

  const hasColumn = (
    tableName: string,
    columnName: string,
  ) =>
    columns.rows.some(
      (row) =>
        row.table_name === tableName &&
        row.column_name === columnName,
    );

  if (
    !hasColumn(
      "teacher_profile",
      "applicationStatus",
    ) ||
    !hasColumn(
      "teacher_intro_video",
      "playbackId",
    )
  ) {
    throw new Error(
      "Pre-Wave1 verification failed: expected legacy columns are missing.",
    );
  }

  if (
    hasColumn(
      "user",
      "accountStatus",
    ) ||
    hasColumn(
      "teacher_profile",
      "reviewCycle",
    ) ||
    hasColumn(
      "teacher_intro_video",
      "publicPlaybackId",
    )
  ) {
    throw new Error(
      "Pre-Wave1 verification failed: Wave 1 schema already exists.",
    );
  }

  console.log(
    "Verified exact pre-Wave1 schema boundary.",
  );
}

async function main() {
  const connectionString =
    getTestDatabaseUrl();

  const client = new Client({
    connectionString,
    application_name:
      "takineo-pre-wave1-test-setup",
  });

  await client.connect();

  try {
    await verifyIdentity(client);
    await verifyDatabaseIsEmpty(
      client,
    );

    for (
      const migrationName
      of PRE_WAVE1_MIGRATIONS
    ) {
      await applyMigration(
        client,
        migrationName,
      );
    }

    await verifyPreWave1Schema(
      client,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Pre-Wave1 test database preparation failed.",
  );

  if (error instanceof Error) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
