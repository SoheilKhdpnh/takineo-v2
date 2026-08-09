import "dotenv/config";

import {
  Client,
} from "pg";

import {
  getTestDatabaseUrl,
} from "./test-database-url";

async function main() {
  const client = new Client({
    connectionString:
      getTestDatabaseUrl(),
    application_name:
      "takineo-pre-wave1-verification",
  });

  await client.connect();

  try {
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

    if (
      !db ||
      db.database_name !== "takineo_test" ||
      db.user_name !== "takineo_test" ||
      db.server_address !== "127.0.0.1" ||
      db.server_port !== 5432
    ) {
      throw new Error(
        "Refusing verification: unexpected database identity.",
      );
    }

    const profiles = await client.query<{
      id: string;
      applicationStatus: string;
      profileCompletedAt: Date | null;
      applicationSubmittedAt: Date | null;
      applicationReviewedAt: Date | null;
      applicationReviewNote: string | null;
    }>(`
      SELECT
        "id",
        "applicationStatus",
        "profileCompletedAt",
        "applicationSubmittedAt",
        "applicationReviewedAt",
        "applicationReviewNote"
      FROM "teacher_profile"
      ORDER BY "id"
    `);

    const videos = await client.query<{
      id: string;
      teacherProfileId: string;
      provider: string;
      uploadId: string | null;
      assetId: string | null;
      playbackId: string | null;
      status: string;
      durationSeconds: number | null;
      rejectionReason: string | null;
      submittedAt: Date | null;
      reviewedAt: Date | null;
    }>(`
      SELECT
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
        "reviewedAt"
      FROM "teacher_intro_video"
      ORDER BY "id"
    `);

    if (
      profiles.rows.length !== 7 ||
      videos.rows.length !== 7
    ) {
      throw new Error(
        "Expected exactly 7 legacy profiles and 7 legacy videos.",
      );
    }

    const profileById =
      new Map(
        profiles.rows.map(
          (row) => [row.id, row],
        ),
      );

    const videoById =
      new Map(
        videos.rows.map(
          (row) => [row.id, row],
        ),
      );

    const expectProfileStatus = (
      id: string,
      status: string,
    ) => {
      const row = profileById.get(id);

      if (
        !row ||
        row.applicationStatus !== status
      ) {
        throw new Error(
          `Unexpected legacy profile status for ${id}.`,
        );
      }
    };

    const expectVideo = (
      id: string,
      expected: {
        status: string;
        durationSeconds: number;
        playbackId?: string | null;
      },
    ) => {
      const row = videoById.get(id);

      if (
        !row ||
        row.status !== expected.status ||
        row.durationSeconds !==
          expected.durationSeconds ||
        row.playbackId !==
          (expected.playbackId ?? null)
      ) {
        throw new Error(
          `Unexpected legacy video evidence for ${id}.`,
        );
      }
    };

    expectProfileStatus(
      "tp_draft_public",
      "DRAFT",
    );

    expectProfileStatus(
      "tp_rejected_bad_video",
      "REJECTED",
    );

    expectProfileStatus(
      "tp_pending_good",
      "PENDING_REVIEW",
    );

    expectProfileStatus(
      "tp_pending_bad",
      "PENDING_REVIEW",
    );

    expectProfileStatus(
      "tp_approved_good",
      "APPROVED",
    );

    expectProfileStatus(
      "tp_approved_profile_bad",
      "APPROVED",
    );

    expectProfileStatus(
      "tp_suspended_good",
      "SUSPENDED",
    );

    expectVideo(
      "v_draft_public",
      {
        status: "APPROVED",
        durationSeconds: 90,
        playbackId:
          "public_draft_public",
      },
    );

    expectVideo(
      "v_rejected_bad_video",
      {
        status: "APPROVED",
        durationSeconds: 90,
      },
    );

    expectVideo(
      "v_pending_good",
      {
        status: "READY_FOR_REVIEW",
        durationSeconds: 75,
      },
    );

    expectVideo(
      "v_pending_bad",
      {
        status: "READY_FOR_REVIEW",
        durationSeconds: 30,
      },
    );

    expectVideo(
      "v_approved_good",
      {
        status: "APPROVED",
        durationSeconds: 100,
        playbackId:
          "public_approved_good",
      },
    );

    expectVideo(
      "v_approved_profile_bad",
      {
        status: "APPROVED",
        durationSeconds: 90,
      },
    );

    expectVideo(
      "v_suspended_good",
      {
        status: "APPROVED",
        durationSeconds: 110,
        playbackId:
          "public_suspended_good",
      },
    );

    const rejected =
      videoById.get(
        "v_rejected_bad_video",
      );

    if (
      rejected?.uploadId !==
        "bad upload id" ||
      rejected.rejectionReason !==
        "legacy bad video reason"
    ) {
      throw new Error(
        "Malformed editable legacy video fixture does not match expected source evidence.",
      );
    }

    const incomplete =
      profileById.get(
        "tp_approved_profile_bad",
      );

    if (
      !incomplete ||
      incomplete.profileCompletedAt !==
        null
    ) {
      throw new Error(
        "Expected approved_profile_bad to have an incomplete profile.",
      );
    }

    console.log(
      "Verified all 7 pre-Wave1 legacy fixtures.",
    );

    console.log(
      "Legacy source state is ready for Wave 1 migration testing.",
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Pre-Wave1 legacy verification failed.",
  );

  if (error instanceof Error) {
    console.error(error.message);
  }

  process.exitCode = 1;
});
