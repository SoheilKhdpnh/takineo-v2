import "dotenv/config";

import {
  Client,
} from "pg";

import {
  getTestDatabaseUrl,
} from "./test-database-url";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function timestampWallClock(
  value: Date | null,
): string | null {
  if (!value) return null;

  const pad = (
    number: number,
    width = 2,
  ) =>
    number
      .toString()
      .padStart(width, "0");

  return [
    pad(value.getFullYear(), 4),
    "-",
    pad(value.getMonth() + 1),
    "-",
    pad(value.getDate()),
    "T",
    pad(value.getHours()),
    ":",
    pad(value.getMinutes()),
    ":",
    pad(value.getSeconds()),
    ".",
    pad(value.getMilliseconds(), 3),
    "Z",
  ].join("");
}

async function expectDatabaseError(
  client: Client,
  operation: () => Promise<unknown>,
  description: string,
): Promise<void> {
  await client.query("BEGIN");

  try {
    await operation();

    throw new Error(
      `${description} unexpectedly succeeded.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");

    if (
      error instanceof Error &&
      error.message ===
        `${description} unexpectedly succeeded.`
    ) {
      throw error;
    }
  }
}

async function main() {
  const client = new Client({
    connectionString:
      getTestDatabaseUrl(),
    application_name:
      "takineo-wave1-post-migration-verifier",
  });

  await client.connect();

  try {
    /*
     * --------------------------------------------------
     * 1. Safety / identity
     * --------------------------------------------------
     */

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

    const db = identity.rows[0];

    assert(
      db?.database_name === "takineo_test" &&
        db.user_name === "takineo_test" &&
        db.server_address === "127.0.0.1" &&
        db.server_port === 5432,
      "Unexpected database identity.",
    );

    /*
     * --------------------------------------------------
     * 2. Wave 1 schema boundary
     * --------------------------------------------------
     */

    const schema = await client.query<{
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

    const wave1 = schema.rows[0];

    assert(
      wave1 &&
        !wave1.legacy_playback &&
        wave1.public_playback &&
        wave1.account_status &&
        wave1.review_cycle &&
        wave1.admin_access &&
        wave1.admin_audit &&
        wave1.reconciliation,
      "Wave 1 schema verification failed.",
    );

    /*
     * --------------------------------------------------
     * 3. All legacy users became ACTIVE
     * --------------------------------------------------
     */

    const users = await client.query<{
      id: string;
      accountStatus: string;
    }>(`
      SELECT
        "id",
        "accountStatus"
      FROM "user"
      ORDER BY "id"
    `);

    assert(
      users.rows.length === 7,
      "Expected exactly 7 users.",
    );

    assert(
      users.rows.every(
        (row) =>
          row.accountStatus === "ACTIVE",
      ),
      "Expected every legacy user to migrate as ACTIVE.",
    );

    /*
     * --------------------------------------------------
     * 4. Profile migration outcomes + exact snapshots
     * --------------------------------------------------
     */

    const profiles = await client.query<{
      id: string;
      applicationStatus: string;
      reviewCycle: number;
      profileRevision: number;

      submittedProfileRevision: number | null;
      submittedVideoId: string | null;
      submittedVideoRevision: number | null;
      submittedVideoUploadId: string | null;
      submittedVideoAssetId: string | null;

      legacyApplicationStatus: string | null;
      legacyApplicationSubmittedAt: Date | null;
      legacyApplicationReviewedAt: Date | null;
      legacyApplicationReviewNote: string | null;
      legacyTrustMigrationReason: string | null;

      applicationSubmittedAt: Date | null;
      applicationReviewedAt: Date | null;
      applicationReviewNote: string | null;
    }>(`
      SELECT
        "id",
        "applicationStatus",
        "reviewCycle",
        "profileRevision",

        "submittedProfileRevision",
        "submittedVideoId",
        "submittedVideoRevision",
        "submittedVideoUploadId",
        "submittedVideoAssetId",

        "legacyApplicationStatus",
        "legacyApplicationSubmittedAt",
        "legacyApplicationReviewedAt",
        "legacyApplicationReviewNote",
        "legacyTrustMigrationReason",

        "applicationSubmittedAt",
        "applicationReviewedAt",
        "applicationReviewNote"

      FROM "teacher_profile"
      ORDER BY "id"
    `);

    const profile =
      new Map(
        profiles.rows.map(
          (row) => [row.id, row],
        ),
      );

    assert(
      profiles.rows.length === 7,
      "Expected 7 migrated profiles.",
    );

    const profileTimestampMismatches =
      await client.query<{
        id: string;
      }>(`
        SELECT "id"
        FROM "teacher_profile"
        WHERE
          "legacyApplicationSubmittedAt"
            IS DISTINCT FROM
          "applicationSubmittedAt"
          OR
          "legacyApplicationReviewedAt"
            IS DISTINCT FROM
          "applicationReviewedAt"
      `);

    assert(
      profileTimestampMismatches.rows.length === 0,
      "One or more profile legacy timestamps differ from their exact pre-Wave1 values.",
    );

    const draft =
      profile.get("tp_draft_public");

    assert(
      draft?.applicationStatus === "DRAFT",
      "Valid DRAFT profile changed unexpectedly.",
    );

    assert(
      draft.legacyApplicationStatus === "DRAFT",
      "DRAFT legacy status snapshot was not preserved.",
    );

    assert(
      draft.legacyApplicationReviewNote ===
        "legacy draft note",
      "DRAFT legacy note was not preserved.",
    );

    const rejected =
      profile.get(
        "tp_rejected_bad_video",
      );

    assert(
      rejected?.applicationStatus ===
        "REJECTED",
      "Legacy REJECTED profile changed unexpectedly.",
    );

    assert(
      rejected.legacyApplicationStatus ===
        "REJECTED",
      "Rejected profile snapshot was not preserved.",
    );

    assert(
      timestampWallClock(
        rejected.legacyApplicationSubmittedAt,
      ) === "2026-07-30T10:00:00.000Z",
      "Rejected submission timestamp snapshot changed.",
    );

    assert(
      timestampWallClock(
        rejected.legacyApplicationReviewedAt,
      ) === "2026-08-01T11:00:00.000Z",
      "Rejected review timestamp snapshot changed.",
    );

    assert(
      rejected.legacyApplicationReviewNote ===
        "legacy profile rejection note",
      "Rejected review note snapshot changed.",
    );

    const pendingGood =
      profile.get("tp_pending_good");

    assert(
      pendingGood?.applicationStatus ===
        "PENDING_REVIEW",
      "Valid pending application was not preserved.",
    );

    assert(
      pendingGood.reviewCycle === 1 &&
        pendingGood.profileRevision === 1 &&
        pendingGood.submittedProfileRevision === 1 &&
        pendingGood.submittedVideoId ===
          "v_pending_good" &&
        pendingGood.submittedVideoRevision === 1 &&
        pendingGood.submittedVideoUploadId ===
          "upload_pending_good" &&
        pendingGood.submittedVideoAssetId ===
          "asset_pending_good",
      "Valid pending review snapshot was not reconstructed correctly.",
    );

    assert(
      pendingGood.legacyApplicationStatus ===
        "PENDING_REVIEW" &&
        timestampWallClock(
          pendingGood.legacyApplicationSubmittedAt,
        ) === "2026-08-03T10:00:00.000Z" &&
        pendingGood.legacyApplicationReviewNote ===
          "legacy pending note",
      "Valid pending legacy history was not preserved.",
    );

    const pendingBad =
      profile.get("tp_pending_bad");

    assert(
      pendingBad?.applicationStatus ===
        "REJECTED",
      "Malformed pending application was not downgraded.",
    );

    assert(
      pendingBad.legacyApplicationStatus ===
        "PENDING_REVIEW",
      "Malformed pending legacy status was lost.",
    );

    assert(
      pendingBad.legacyTrustMigrationReason ===
        "LEGACY_REVIEW_STATE_REQUIRES_RESUBMISSION",
      "Malformed pending migration reason is incorrect.",
    );

    assert(
      pendingBad.applicationReviewNote ===
        "legacy broken pending note" &&
        pendingBad.legacyApplicationReviewNote ===
          "legacy broken pending note",
      "Malformed pending historical note changed.",
    );

    const approvedGood =
      profile.get("tp_approved_good");

    assert(
      approvedGood?.applicationStatus ===
        "APPROVED",
      "Valid approved application was not preserved.",
    );

    assert(
      approvedGood.reviewCycle === 1 &&
        approvedGood.submittedProfileRevision === 1 &&
        approvedGood.submittedVideoId ===
          "v_approved_good" &&
        approvedGood.submittedVideoRevision === 1 &&
        approvedGood.submittedVideoUploadId ===
          "upload_approved_good" &&
        approvedGood.submittedVideoAssetId ===
          "asset_approved_good",
      "Approved evidence snapshot is incorrect.",
    );

    assert(
      approvedGood.legacyApplicationStatus ===
        "APPROVED" &&
        timestampWallClock(
          approvedGood.legacyApplicationReviewedAt,
        ) === "2026-08-04T10:00:00.000Z" &&
        approvedGood.legacyApplicationReviewNote ===
          "legacy approved note",
      "Approved legacy history was not preserved.",
    );

    const approvedProfileBad =
      profile.get(
        "tp_approved_profile_bad",
      );

    assert(
      approvedProfileBad?.applicationStatus ===
        "REJECTED",
      "Incomplete approved profile was not downgraded.",
    );

    assert(
      approvedProfileBad.legacyApplicationStatus ===
        "APPROVED",
      "Incomplete approved profile lost legacy status.",
    );

    assert(
      approvedProfileBad.legacyTrustMigrationReason ===
        "LEGACY_TRUST_EVIDENCE_INSUFFICIENT",
      "Incomplete approved profile migration reason is incorrect.",
    );

    const suspended =
      profile.get(
        "tp_suspended_good",
      );

    assert(
      suspended?.applicationStatus ===
        "SUSPENDED",
      "Valid suspended state was not preserved.",
    );

    assert(
      suspended.reviewCycle === 1 &&
        suspended.submittedVideoId ===
          "v_suspended_good" &&
        suspended.submittedVideoRevision === 1,
      "Suspended evidence snapshot is incorrect.",
    );

    assert(
      suspended.legacyApplicationStatus ===
        "SUSPENDED",
      "Suspended legacy status was not preserved.",
    );

    /*
     * --------------------------------------------------
     * 5. Video migration outcomes + exact snapshots
     * --------------------------------------------------
     */

    const videos = await client.query<{
      id: string;
      status: string;
      provider: string;
      uploadId: string | null;
      assetId: string | null;
      publicPlaybackId: string | null;
      revision: number;
      rejectionReason: string | null;

      legacyStatus: string | null;
      legacyRejectionReason: string | null;
      legacySubmittedAt: Date | null;
      legacyReviewedAt: Date | null;
      legacyTrustMigrationReason: string | null;
    }>(`
      SELECT
        "id",
        "status",
        "provider",
        "uploadId",
        "assetId",
        "publicPlaybackId",
        "revision",
        "rejectionReason",

        "legacyStatus",
        "legacyRejectionReason",
        "legacySubmittedAt",
        "legacyReviewedAt",
        "legacyTrustMigrationReason"

      FROM "teacher_intro_video"
      ORDER BY "id"
    `);

    const video =
      new Map(
        videos.rows.map(
          (row) => [row.id, row],
        ),
      );

    assert(
      videos.rows.length === 7,
      "Expected 7 migrated videos.",
    );

    const videoTimestampMismatches =
      await client.query<{
        id: string;
      }>(`
        SELECT "id"
        FROM "teacher_intro_video"
        WHERE
          "legacySubmittedAt"
            IS DISTINCT FROM
          "submittedAt"
          OR
          "legacyReviewedAt"
            IS DISTINCT FROM
          "reviewedAt"
      `);

    assert(
      videoTimestampMismatches.rows.length === 0,
      "One or more video legacy timestamps differ from their exact pre-Wave1 values.",
    );

    const badEditable =
      video.get(
        "v_rejected_bad_video",
      );

    assert(
      badEditable?.status ===
        "REJECTED",
      "Malformed editable terminal video was not rejected.",
    );

    assert(
      badEditable.legacyStatus ===
        "APPROVED",
      "Malformed editable video lost legacy status.",
    );

    assert(
      badEditable.legacyRejectionReason ===
        "legacy bad video reason" &&
        badEditable.rejectionReason ===
          "legacy bad video reason",
      "Malformed editable rejection reason was not preserved.",
    );

    assert(
      badEditable.legacyTrustMigrationReason ===
        "LEGACY_EDITABLE_VIDEO_EVIDENCE_INVALID",
      "Malformed editable video migration reason is incorrect.",
    );

    const badPendingVideo =
      video.get("v_pending_bad");

    assert(
      badPendingVideo?.status ===
        "REJECTED",
      "Invalid pending video was not rejected.",
    );

    assert(
      badPendingVideo.legacyStatus ===
        "READY_FOR_REVIEW",
      "Invalid pending video legacy status was lost.",
    );

    assert(
      badPendingVideo.rejectionReason ===
        "LEGACY_VIDEO_REQUIRES_REPLACEMENT",
      "Invalid pending video replacement reason is incorrect.",
    );

    assert(
      badPendingVideo.legacyTrustMigrationReason ===
        "LEGACY_VIDEO_EVIDENCE_INSUFFICIENT",
      "Invalid pending video migration reason is incorrect.",
    );

    const reusableApprovedVideo =
      video.get(
        "v_approved_profile_bad",
      );

    assert(
      reusableApprovedVideo?.status ===
        "APPROVED",
      "Valid approved video should remain reusable after profile downgrade.",
    );

    assert(
      reusableApprovedVideo
        .legacyStatus === "APPROVED",
      "Reusable video legacy status snapshot is missing.",
    );

    for (const id of [
      "v_draft_public",
      "v_pending_good",
      "v_approved_good",
      "v_suspended_good",
    ]) {
      const row = video.get(id);

      assert(
        row?.revision === 1,
        `Expected migrated video revision 1 for ${id}.`,
      );
    }

    /*
     * --------------------------------------------------
     * 6. Legacy public playback reconciliation
     * --------------------------------------------------
     */

    const reconciliations =
      await client.query<{
        introVideoId: string;
        videoRevision: number;
        assetId: string;
        playbackId: string | null;
        desiredState: string;
        status: string;
        intentGeneration: number;
        attemptCount: number;
      }>(`
        SELECT
          "introVideoId",
          "videoRevision",
          "assetId",
          "playbackId",
          "desiredState",
          "status",
          "intentGeneration",
          "attemptCount"
        FROM "mux_playback_reconciliation"
        ORDER BY "introVideoId"
      `);

    assert(
      reconciliations.rows.length === 3,
      `Expected 3 reconciliation intents, received ${reconciliations.rows.length}.`,
    );

    const reconciliation =
      new Map(
        reconciliations.rows.map(
          (row) => [
            row.introVideoId,
            row,
          ],
        ),
      );

    const draftReconciliation =
      reconciliation.get(
        "v_draft_public",
      );

    assert(
      draftReconciliation?.desiredState ===
        "REVOKED" &&
        draftReconciliation.playbackId ===
          "public_draft_public",
      "DRAFT legacy public playback should migrate to REVOKED reconciliation.",
    );

    const approvedReconciliation =
      reconciliation.get(
        "v_approved_good",
      );

    assert(
      approvedReconciliation?.desiredState ===
        "ENABLED" &&
        approvedReconciliation.playbackId ===
          "public_approved_good",
      "Eligible approved playback should migrate to ENABLED reconciliation.",
    );

    const suspendedReconciliation =
      reconciliation.get(
        "v_suspended_good",
      );

    assert(
      suspendedReconciliation?.desiredState ===
        "REVOKED" &&
        suspendedReconciliation.playbackId ===
          "public_suspended_good",
      "Suspended legacy public playback should migrate to REVOKED reconciliation.",
    );

    for (
      const row
      of reconciliations.rows
    ) {
      assert(
        row.status === "PENDING" &&
          row.intentGeneration === 1 &&
          row.attemptCount === 0 &&
          row.videoRevision === 1,
        `Unexpected initial reconciliation state for ${row.introVideoId}.`,
      );
    }

    /*
     * --------------------------------------------------
     * 7. Audit rows are DB-level append-only
     * --------------------------------------------------
     */

    await client.query(`
      INSERT INTO "admin_audit_event" (
        "id",
        "actorUserId",
        "targetUserId",
        "teacherProfileId",
        "introVideoId",
        "action",
        "reason"
      )
      VALUES (
        'audit_immutable_test',
        'u_approved_good',
        'u_approved_good',
        'tp_approved_good',
        'v_approved_good',
        'APPLICATION_APPROVED',
        'immutability verification'
      )
      ON CONFLICT ("id") DO NOTHING
    `);

    await expectDatabaseError(
      client,
      () =>
        client.query(`
          UPDATE "admin_audit_event"
          SET "reason" = 'mutated'
          WHERE "id" = 'audit_immutable_test'
        `),
      "Admin audit UPDATE",
    );

    await expectDatabaseError(
      client,
      () =>
        client.query(`
          DELETE FROM "admin_audit_event"
          WHERE "id" = 'audit_immutable_test'
        `),
      "Admin audit DELETE",
    );

    await expectDatabaseError(
      client,
      () =>
        client.query(`
          TRUNCATE TABLE "admin_audit_event"
        `),
      "Admin audit TRUNCATE",
    );

    const audit =
      await client.query<{
        reason: string | null;
      }>(`
        SELECT "reason"
        FROM "admin_audit_event"
        WHERE "id" = 'audit_immutable_test'
      `);

    assert(
      audit.rows.length === 1 &&
        audit.rows[0]?.reason ===
          "immutability verification",
      "Audit immutability test row was changed or removed.",
    );

    console.log(
      "Verified all 7 Wave 1 legacy migration outcomes.",
    );

    console.log(
      "Verified exact legacy profile/video history snapshots.",
    );

    console.log(
      "Verified 3 durable public-playback reconciliation intents.",
    );

    console.log(
      "Verified admin audit UPDATE, DELETE, and TRUNCATE protection.",
    );

    console.log(
      "Wave 1 successful migration path passed.",
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Wave 1 migration verification failed.",
  );

  if (error instanceof Error) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
