import "dotenv/config";

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

async function verifySafety(
  client: Client,
): Promise<void> {
  const identity = await client.query<{
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

  const row = identity.rows[0];

  if (
    !row ||
    row.database_name !== EXPECTED_DATABASE ||
    row.user_name !== EXPECTED_USER ||
    row.server_address !== EXPECTED_HOST ||
    row.server_port !== EXPECTED_PORT
  ) {
    throw new Error(
      "Refusing legacy seed: database identity does not match isolated takineo_test.",
    );
  }

  const boundary = await client.query<{
    has_playback_id: boolean;
    has_public_playback_id: boolean;
    has_account_status: boolean;
    has_review_cycle: boolean;
  }>(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'teacher_intro_video'
          AND column_name = 'playbackId'
      ) AS has_playback_id,

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
      ) AS has_review_cycle
  `);

  const schema = boundary.rows[0];

  if (
    !schema ||
    !schema.has_playback_id ||
    schema.has_public_playback_id ||
    schema.has_account_status ||
    schema.has_review_cycle
  ) {
    throw new Error(
      "Refusing legacy seed: database is not at the exact pre-Wave1 schema boundary.",
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
    count.users !== 0 ||
    count.profiles !== 0 ||
    count.videos !== 0
  ) {
    throw new Error(
      "Refusing legacy seed: expected an empty pre-Wave1 database.",
    );
  }

  console.log(
    "Verified empty isolated pre-Wave1 database.",
  );
}

async function seedLegacyCases(
  client: Client,
): Promise<void> {
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
    VALUES
      (
        'u_draft_public',
        'Draft Public',
        'draft-public@example.test',
        true,
        '2026-07-20T08:00:00Z',
        '2026-07-20T08:00:00Z',
        'TEACHER',
        '2026-07-20T08:30:00Z'
      ),
      (
        'u_rejected_bad_video',
        'Rejected Bad Video',
        'rejected-bad-video@example.test',
        true,
        '2026-07-21T08:00:00Z',
        '2026-07-21T08:00:00Z',
        'TEACHER',
        '2026-07-21T08:30:00Z'
      ),
      (
        'u_pending_good',
        'Pending Good',
        'pending-good@example.test',
        true,
        '2026-07-22T08:00:00Z',
        '2026-07-22T08:00:00Z',
        'TEACHER',
        '2026-07-22T08:30:00Z'
      ),
      (
        'u_pending_bad',
        'Pending Bad',
        'pending-bad@example.test',
        true,
        '2026-07-23T08:00:00Z',
        '2026-07-23T08:00:00Z',
        'TEACHER',
        '2026-07-23T08:30:00Z'
      ),
      (
        'u_approved_good',
        'Approved Good',
        'approved-good@example.test',
        true,
        '2026-07-24T08:00:00Z',
        '2026-07-24T08:00:00Z',
        'TEACHER',
        '2026-07-24T08:30:00Z'
      ),
      (
        'u_approved_profile_bad',
        'Approved Profile Bad',
        'approved-profile-bad@example.test',
        true,
        '2026-07-25T08:00:00Z',
        '2026-07-25T08:00:00Z',
        'TEACHER',
        '2026-07-25T08:30:00Z'
      ),
      (
        'u_suspended_good',
        'Suspended Good',
        'suspended-good@example.test',
        true,
        '2026-07-26T08:00:00Z',
        '2026-07-26T08:00:00Z',
        'TEACHER',
        '2026-07-26T08:30:00Z'
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
    VALUES
      (
        'tp_draft_public',
        'u_draft_public',
        '2026-07-20T09:00:00Z',
        '2026-08-01T09:00:00Z',
        'Legacy draft profile.',
        3,
        'Draft teacher',
        'fa',
        '2026-07-20T10:00:00Z',
        'en',
        'Asia/Tehran',
        'DRAFT',
        NULL,
        NULL,
        'legacy draft note'
      ),
      (
        'tp_rejected_bad_video',
        'u_rejected_bad_video',
        '2026-07-21T09:00:00Z',
        '2026-08-02T09:00:00Z',
        'Legacy rejected profile.',
        5,
        'Rejected teacher',
        'fa',
        '2026-07-21T10:00:00Z',
        'en',
        'Asia/Tehran',
        'REJECTED',
        '2026-07-30T10:00:00Z',
        '2026-08-01T11:00:00Z',
        'legacy profile rejection note'
      ),
      (
        'tp_pending_good',
        'u_pending_good',
        '2026-07-22T09:00:00Z',
        '2026-08-03T09:00:00Z',
        'Valid pending profile.',
        4,
        'Pending teacher',
        'fa',
        '2026-07-22T10:00:00Z',
        'en',
        'Asia/Tehran',
        'PENDING_REVIEW',
        '2026-08-03T10:00:00Z',
        NULL,
        'legacy pending note'
      ),
      (
        'tp_pending_bad',
        'u_pending_bad',
        '2026-07-23T09:00:00Z',
        '2026-08-03T12:00:00Z',
        'Broken pending profile.',
        2,
        'Broken pending teacher',
        'fa',
        '2026-07-23T10:00:00Z',
        'en',
        'Asia/Tehran',
        'PENDING_REVIEW',
        '2026-08-03T12:30:00Z',
        NULL,
        'legacy broken pending note'
      ),
      (
        'tp_approved_good',
        'u_approved_good',
        '2026-07-24T09:00:00Z',
        '2026-08-04T09:00:00Z',
        'Valid approved profile.',
        8,
        'Approved teacher',
        'fa',
        '2026-07-24T10:00:00Z',
        'en',
        'Asia/Tehran',
        'APPROVED',
        '2026-08-01T10:00:00Z',
        '2026-08-04T10:00:00Z',
        'legacy approved note'
      ),
      (
        'tp_approved_profile_bad',
        'u_approved_profile_bad',
        '2026-07-25T09:00:00Z',
        '2026-08-05T09:00:00Z',
        'Incomplete approved profile.',
        6,
        'Incomplete approved teacher',
        'fa',
        NULL,
        'en',
        'Asia/Tehran',
        'APPROVED',
        '2026-08-02T10:00:00Z',
        '2026-08-05T10:00:00Z',
        'legacy incomplete profile note'
      ),
      (
        'tp_suspended_good',
        'u_suspended_good',
        '2026-07-26T09:00:00Z',
        '2026-08-06T09:00:00Z',
        'Valid suspended profile.',
        9,
        'Suspended teacher',
        'fa',
        '2026-07-26T10:00:00Z',
        'en',
        'Asia/Tehran',
        'SUSPENDED',
        '2026-08-02T11:00:00Z',
        '2026-08-06T10:00:00Z',
        'legacy suspension note'
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
    VALUES
      (
        'v_draft_public',
        'tp_draft_public',
        'mux',
        'upload_draft_public',
        'asset_draft_public',
        'public_draft_public',
        'APPROVED',
        90,
        NULL,
        '2026-07-30T09:00:00Z',
        '2026-07-31T09:00:00Z',
        '2026-07-29T09:00:00Z',
        '2026-07-31T09:00:00Z'
      ),
      (
        'v_rejected_bad_video',
        'tp_rejected_bad_video',
        'mux',
        'bad upload id',
        'asset_rejected_bad',
        NULL,
        'APPROVED',
        90,
        'legacy bad video reason',
        '2026-07-30T10:00:00Z',
        '2026-08-01T10:00:00Z',
        '2026-07-29T10:00:00Z',
        '2026-08-01T10:00:00Z'
      ),
      (
        'v_pending_good',
        'tp_pending_good',
        'mux',
        'upload_pending_good',
        'asset_pending_good',
        NULL,
        'READY_FOR_REVIEW',
        75,
        NULL,
        '2026-08-03T10:00:00Z',
        NULL,
        '2026-08-02T10:00:00Z',
        '2026-08-03T10:00:00Z'
      ),
      (
        'v_pending_bad',
        'tp_pending_bad',
        'mux',
        'upload_pending_bad',
        'asset_pending_bad',
        NULL,
        'READY_FOR_REVIEW',
        30,
        NULL,
        '2026-08-03T12:30:00Z',
        NULL,
        '2026-08-02T12:00:00Z',
        '2026-08-03T12:30:00Z'
      ),
      (
        'v_approved_good',
        'tp_approved_good',
        'mux',
        'upload_approved_good',
        'asset_approved_good',
        'public_approved_good',
        'APPROVED',
        100,
        NULL,
        '2026-08-01T10:00:00Z',
        '2026-08-04T10:00:00Z',
        '2026-07-31T10:00:00Z',
        '2026-08-04T10:00:00Z'
      ),
      (
        'v_approved_profile_bad',
        'tp_approved_profile_bad',
        'mux',
        'upload_approved_profile_bad',
        'asset_approved_profile_bad',
        NULL,
        'APPROVED',
        90,
        NULL,
        '2026-08-02T10:00:00Z',
        '2026-08-05T10:00:00Z',
        '2026-08-01T10:00:00Z',
        '2026-08-05T10:00:00Z'
      ),
      (
        'v_suspended_good',
        'tp_suspended_good',
        'mux',
        'upload_suspended_good',
        'asset_suspended_good',
        'public_suspended_good',
        'APPROVED',
        110,
        NULL,
        '2026-08-02T11:00:00Z',
        '2026-08-06T10:00:00Z',
        '2026-08-01T11:00:00Z',
        '2026-08-06T10:00:00Z'
      );
  `);
}

async function verifySeed(
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

  expectCount(
    counts.rows[0]?.users,
    7,
    "users",
  );

  expectCount(
    counts.rows[0]?.profiles,
    7,
    "teacher profiles",
  );

  expectCount(
    counts.rows[0]?.videos,
    7,
    "intro videos",
  );

  console.log(
    "Seeded 7 deterministic legacy Wave 1 migration cases.",
  );
}

function expectCount(
  actual: number | undefined,
  expected: number,
  label: string,
): void {
  if (actual !== expected) {
    throw new Error(
      `Legacy seed verification failed for ${label}: expected ${expected}, received ${String(actual)}.`,
    );
  }
}

async function main() {
  const connectionString =
    getTestDatabaseUrl();

  const client = new Client({
    connectionString,
    application_name:
      "takineo-wave1-legacy-seed",
  });

  await client.connect();

  try {
    await verifySafety(client);

    await client.query("BEGIN");

    try {
      await seedLegacyCases(client);
      await verifySeed(client);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Legacy Wave 1 seed failed.",
  );

  if (error instanceof Error) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
