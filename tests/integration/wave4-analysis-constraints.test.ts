import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createHash } from "node:crypto";
import { Client } from "pg";

import { getTestDatabaseUrl } from "@/tests/support/test-database-url";

const connectionString = getTestDatabaseUrl();

let setupClient: Client | null = null;

const IDS = {
  teacherUser: "it_wave4_teacher_user",
  teacherProfile: "it_wave4_teacher_profile",
  studentA: "it_wave4_student_a",
  studentB: "it_wave4_student_b",
  sessionA: "it_wave4_session_a",
  sessionB: "it_wave4_session_b",
} as const;

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

const HANDWRITTEN = [
  "ss_analysis_run_active_session_key",
  "ss_analysis_run_student_role_check",
  "ss_analysis_run_teacher_role_check",
  "ss_analysis_run_student_artifact_pair_fk",
  "ss_analysis_run_teacher_artifact_pair_fk",
  "ss_analysis_run_terminal_shape_check",
  "ss_analysis_run_failure_code_check",
  "ss_analysis_run_attempt_check",
  "ss_audio_artifact_sha256_format_check",
  "ss_audio_artifact_positive_metrics_check",
  "ss_audio_artifact_reference_format_check",
  "ss_transcript_provenance_check",
  "ss_report_provenance_check",
  "ss_fluency_provenance_check",
  "ss_correction_provenance_check",
  "ss_vocabulary_observation_provenance_check",
  "ss_weak_point_provenance_check",
  "ss_vocabulary_alternative_provenance_check",
  "ss_suggestion_provenance_check",
  "ss_teacher_feedback_provenance_check",
  "ss_teacher_feedback_body_check",
  "ss_correction_distinct_text_check",
  "ss_vocabulary_alternative_level_check",
] as const;

const BOOKING_GUARDS = [
  "speaking_session_exact_15m_check",
  "speaking_session_start_grid_check",
  "tar_no_active_overlap",
] as const;

const WAVE3_GRANT_COLUMNS = [
  "id",
  "sessionId",
  "participantUserId",
  "participantRole",
  "clientJoinAttemptId",
  "providerParticipantRef",
  "authorizedAt",
  "createdAt",
] as const;

const WAVE3_EVENT_COLUMNS = [
  "id",
  "sessionId",
  "providerEventRef",
  "type",
  "occurredAt",
  "providerParticipantRef",
  "connectionRef",
  "recordedAt",
] as const;

type PgFailure = Error & {
  code?: string;
  constraint?: string;
};

async function createClient(applicationName: string): Promise<Client> {
  const client = new Client({
    connectionString,
    application_name: applicationName,
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
    const pgError = error as PgFailure;
    expect(pgError.code).toBe(expectedCode);
    if (expectedConstraint) {
      expect(pgError.constraint).toBe(expectedConstraint);
    }
    return pgError;
  }

  throw new Error(
    `Expected PostgreSQL error ${expectedCode}${
      expectedConstraint ? ` on ${expectedConstraint}` : ""
    }, but the operation succeeded.`,
  );
}

function sha(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

async function cleanupFixtures() {
  if (!setupClient) {
    return;
  }

  await setupClient.query(`
    DELETE FROM "speaking_session_suggestion"
    WHERE "id" LIKE 'it_wave4_%'
       OR "runId" LIKE 'it_wave4_%'
  `);
  await setupClient.query(`
    DELETE FROM "speaking_session_correction"
    WHERE "id" LIKE 'it_wave4_%'
       OR "runId" LIKE 'it_wave4_%'
  `);
  await setupClient.query(`
    DELETE FROM "speaking_session_vocabulary_alternative"
    WHERE "id" LIKE 'it_wave4_%'
       OR "observationId" LIKE 'it_wave4_%'
  `);
  await setupClient.query(`
    DELETE FROM "speaking_session_vocabulary_observation"
    WHERE "id" LIKE 'it_wave4_%'
       OR "runId" LIKE 'it_wave4_%'
  `);
  await setupClient.query(`
    DELETE FROM "speaking_session_weak_point"
    WHERE "id" LIKE 'it_wave4_%'
       OR "runId" LIKE 'it_wave4_%'
  `);
  await setupClient.query(`
    DELETE FROM "speaking_session_fluency_profile"
    WHERE "id" LIKE 'it_wave4_%'
       OR "runId" LIKE 'it_wave4_%'
  `);
  await setupClient.query(`
    DELETE FROM "speaking_session_analysis_report"
    WHERE "id" LIKE 'it_wave4_%'
       OR "runId" LIKE 'it_wave4_%'
  `);
  await setupClient.query(`
    DELETE FROM "speaking_session_transcript"
    WHERE "id" LIKE 'it_wave4_%'
       OR "runId" LIKE 'it_wave4_%'
  `);
  await setupClient.query(`
    DELETE FROM "speaking_session_analysis_run"
    WHERE "id" LIKE 'it_wave4_%'
       OR "sessionId" LIKE 'it_wave4_%'
  `);
  await setupClient.query(`
    DELETE FROM "speaking_session_audio_artifact"
    WHERE "id" LIKE 'it_wave4_%'
       OR "sessionId" LIKE 'it_wave4_%'
  `);
  await setupClient.query(`
    DELETE FROM "speaking_session_teacher_feedback"
    WHERE "id" LIKE 'it_wave4_%'
       OR "sessionId" LIKE 'it_wave4_%'
  `);
  await setupClient.query(`
    DELETE FROM "speaking_session"
    WHERE "id" LIKE 'it_wave4_%'
  `);
  await setupClient.query(`
    DELETE FROM "teacher_profile"
    WHERE "id" LIKE 'it_wave4_%'
  `);
  await setupClient.query(`
    DELETE FROM "user"
    WHERE "id" LIKE 'it_wave4_%'
  `);
}

async function seedUsersAndSessions() {
  if (!setupClient) {
    throw new Error("Integration setup client is unavailable.");
  }

  await setupClient.query(
    `
      INSERT INTO "user" (
        "id", "name", "email", "emailVerified", "role",
        "accountStatus", "createdAt", "updatedAt"
      )
      VALUES
        ($1, 'Wave 4 Teacher', 'wave4-teacher@example.test', true, 'TEACHER',
         'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ($2, 'Wave 4 Student A', 'wave4-student-a@example.test', true, 'STUDENT',
         'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ($3, 'Wave 4 Student B', 'wave4-student-b@example.test', true, 'STUDENT',
         'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [IDS.teacherUser, IDS.studentA, IDS.studentB],
  );

  await setupClient.query(
    `
      INSERT INTO "teacher_profile" (
        "id", "userId", "profileCompletedAt", "applicationStatus",
        "createdAt", "updatedAt"
      )
      VALUES ($1, $2, CURRENT_TIMESTAMP, 'APPROVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [IDS.teacherProfile, IDS.teacherUser],
  );

  await setupClient.query(
    `
      INSERT INTO "speaking_session" (
        "id", "teacherProfileId", "studentUserId", "startAt", "endAt",
        "status", "bookingIdempotencyKey", "createdAt", "updatedAt"
      )
      VALUES
        ($1, $3, $4, '2026-09-13T05:30:00Z', '2026-09-13T05:45:00Z',
         'COMPLETED', 'wave4-session-a', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ($2, $3, $5, '2026-09-13T06:00:00Z', '2026-09-13T06:15:00Z',
         'COMPLETED', 'wave4-session-b', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [IDS.sessionA, IDS.sessionB, IDS.teacherProfile, IDS.studentA, IDS.studentB],
  );
}

async function insertArtifact(options: {
  id: string;
  sessionId?: string;
  role?: "STUDENT" | "TEACHER";
  sha?: string;
  storageKey?: string;
  storageBucket?: string;
  durationMs?: number;
  byteSize?: number;
}) {
  if (!setupClient) {
    throw new Error("Database client is unavailable.");
  }

  return setupClient.query(
    `
      INSERT INTO "speaking_session_audio_artifact" (
        "id", "sessionId", "participantRole", "source", "storageProvider",
        "storageBucket", "storageKey", "container", "durationMs", "byteSize",
        "contentSha256", "capturedAt"
      )
      VALUES (
        $1, $2, $3, 'SYNTHETIC_FIXTURE', 'LOCAL_FILESYSTEM',
        $4, $5, 'WAV', $6, $7, $8, '2026-09-13T05:30:00Z'
      )
    `,
    [
      options.id,
      options.sessionId ?? IDS.sessionA,
      options.role ?? "STUDENT",
      options.storageBucket ?? "wave4-fixtures",
      options.storageKey ?? `${options.id}.wav`,
      options.durationMs ?? 12_000,
      options.byteSize ?? 384_044,
      options.sha ?? sha(options.id),
    ],
  );
}

async function insertRun(options: {
  id: string;
  sessionId?: string;
  studentArtifactId: string;
  teacherArtifactId?: string | null;
  studentRole?: "STUDENT" | "TEACHER";
  teacherRole?: "STUDENT" | "TEACHER" | null;
  key?: string;
  status?:
    | "QUEUED"
    | "TRANSCRIBING"
    | "ANALYZING"
    | "SUCCEEDED"
    | "FAILED"
    | "ABANDONED";
  attempt?: number;
  finishedAt?: string | null;
  failureCode?: string | null;
}) {
  if (!setupClient) {
    throw new Error("Database client is unavailable.");
  }

  const status = options.status ?? "QUEUED";
  const teacherId = options.teacherArtifactId ?? null;
  const teacherRole =
    options.teacherRole === undefined
      ? teacherId
        ? "TEACHER"
        : null
      : options.teacherRole;

  return setupClient.query(
    `
      INSERT INTO "speaking_session_analysis_run" (
        "id", "sessionId", "studentAudioArtifactId", "teacherAudioArtifactId",
        "studentAudioRole", "teacherAudioRole", "requestIdempotencyKey",
        "status", "attempt", "finishedAt", "failureCode", "updatedAt"
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11, CURRENT_TIMESTAMP
      )
    `,
    [
      options.id,
      options.sessionId ?? IDS.sessionA,
      options.studentArtifactId,
      teacherId,
      options.studentRole ?? "STUDENT",
      teacherRole,
      options.key ?? `${options.id}-key`,
      status,
      options.attempt ?? 1,
      options.finishedAt === undefined
        ? status === "SUCCEEDED" || status === "FAILED" || status === "ABANDONED"
          ? "2026-09-13T06:00:00Z"
          : null
        : options.finishedAt,
      options.failureCode === undefined
        ? status === "FAILED" || status === "ABANDONED"
          ? "INTERNAL"
          : null
        : options.failureCode,
    ],
  );
}

describe.sequential("Wave 4 session-analysis PostgreSQL constraints", () => {
  beforeAll(async () => {
    setupClient = await createClient("takineo-wave4-constraints");

    const identity = await setupClient.query<{
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

    expect(identity.rows[0]).toEqual({
      database_name: "takineo_test",
      user_name: "takineo_test",
      server_address: "127.0.0.1",
      server_port: 5432,
    });
  });

  beforeEach(async () => {
    await cleanupFixtures();
    await seedUsersAndSessions();
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

  test("Wave 4 tables and hand-written constraints are installed", async () => {
    const tables = await setupClient!.query<{ n: string }>(
      `
        SELECT tablename AS n
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = ANY($1::text[])
        ORDER BY tablename
      `,
      [WAVE4_TABLES],
    );
    expect(tables.rows.map((row) => row.n)).toEqual([...WAVE4_TABLES].sort());

    const constraints = await setupClient!.query<{ n: string }>(
      `
        SELECT conname AS n
        FROM pg_constraint
        WHERE conname = ANY($1::text[])
      `,
      [HANDWRITTEN.filter((name) => name !== "ss_analysis_run_active_session_key")],
    );
    expect(constraints.rows).toHaveLength(HANDWRITTEN.length - 1);

    const inFlight = await setupClient!.query<{ n: string }>(`
      SELECT indexname AS n
      FROM pg_indexes
      WHERE indexname = 'ss_analysis_run_active_session_key'
    `);
    expect(inFlight.rows).toHaveLength(1);
  });

  test("Wave 2 booking columns and guards are unchanged", async () => {
    const columns = await setupClient!.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'speaking_session'
      ORDER BY ordinal_position
    `);
    expect(columns.rows.map((row) => row.column_name)).toEqual([
      "id",
      "teacherProfileId",
      "studentUserId",
      "startAt",
      "endAt",
      "status",
      "bookingIdempotencyKey",
      "createdAt",
      "updatedAt",
    ]);

    const guards = await setupClient!.query<{ n: string }>(
      `
        SELECT conname AS n
        FROM pg_constraint
        WHERE conname = ANY($1::text[])
      `,
      [BOOKING_GUARDS],
    );
    expect(guards.rows).toHaveLength(BOOKING_GUARDS.length);

    await expectPgFailure(
      () =>
        setupClient!.query(
          `
            INSERT INTO "speaking_session" (
              "id", "teacherProfileId", "studentUserId", "startAt", "endAt",
              "status", "bookingIdempotencyKey", "createdAt", "updatedAt"
            )
            VALUES (
              'it_wave4_session_bad_duration', $1, $2,
              '2026-09-13T07:00:00Z', '2026-09-13T07:20:00Z',
              'SCHEDULED', 'wave4-bad-duration',
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
          `,
          [IDS.teacherProfile, IDS.studentA],
        ),
      "23514",
      "speaking_session_exact_15m_check",
    );
  });

  test("Wave 3 live tables are present and column-frozen", async () => {
    const grant = await setupClient!.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'speaking_session_live_grant'
      ORDER BY ordinal_position
    `);
    expect(grant.rows.map((row) => row.column_name)).toEqual([
      ...WAVE3_GRANT_COLUMNS,
    ]);

    const events = await setupClient!.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'speaking_session_live_event'
      ORDER BY ordinal_position
    `);
    expect(events.rows.map((row) => row.column_name)).toEqual([
      ...WAVE3_EVENT_COLUMNS,
    ]);

    const indexes = await setupClient!.query<{ n: string }>(`
      SELECT indexname AS n
      FROM pg_indexes
      WHERE indexname IN (
        'ss_live_grant_provider_participant_key',
        'ss_live_grant_join_attempt_key',
        'ss_live_event_provider_event_key'
      )
    `);
    expect(indexes.rows).toHaveLength(3);
  });

  test("cross-session artifact pairing is rejected by the database", async () => {
    await insertArtifact({ id: "it_wave4_art_a", sessionId: IDS.sessionA });
    await insertArtifact({
      id: "it_wave4_art_b",
      sessionId: IDS.sessionB,
      sha: sha("bbbb"),
    });

    await expectPgFailure(
      () =>
        insertRun({
          id: "it_wave4_run_cross",
          sessionId: IDS.sessionA,
          studentArtifactId: "it_wave4_art_b",
        }),
      "23503",
      "ss_analysis_run_student_artifact_pair_fk",
    );
  });

  test("a teacher recording cannot occupy the student slot", async () => {
    await insertArtifact({
      id: "it_wave4_art_teacher",
      role: "TEACHER",
      sha: sha("tttt"),
    });

    await expectPgFailure(
      () =>
        insertRun({
          id: "it_wave4_run_wrong_role",
          studentArtifactId: "it_wave4_art_teacher",
        }),
      "23503",
      "ss_analysis_run_student_artifact_pair_fk",
    );
  });

  test("studentAudioRole cannot be rewritten off STUDENT", async () => {
    await insertArtifact({ id: "it_wave4_art_student" });

    await expectPgFailure(
      () =>
        insertRun({
          id: "it_wave4_run_role_rewrite",
          studentArtifactId: "it_wave4_art_student",
          studentRole: "TEACHER",
        }),
      "23514",
      "ss_analysis_run_student_role_check",
    );
  });

  test("teacher slot rejects a student artifact even when the role flag says TEACHER", async () => {
    await insertArtifact({ id: "it_wave4_art_s1", sha: sha("s001") });
    await insertArtifact({
      id: "it_wave4_art_s2",
      sha: sha("s002"),
    });

    await expectPgFailure(
      () =>
        insertRun({
          id: "it_wave4_run_teacher_mismatch",
          studentArtifactId: "it_wave4_art_s1",
          teacherArtifactId: "it_wave4_art_s2",
          teacherRole: "TEACHER",
        }),
      "23503",
      "ss_analysis_run_teacher_artifact_pair_fk",
    );
  });

  test("at most one non-terminal run exists per session", async () => {
    await insertArtifact({ id: "it_wave4_art_q1", sha: sha("q001") });
    await insertArtifact({ id: "it_wave4_art_q2", sha: sha("q002") });
    await insertRun({
      id: "it_wave4_run_q1",
      studentArtifactId: "it_wave4_art_q1",
      status: "QUEUED",
    });

    await expectPgFailure(
      () =>
        insertRun({
          id: "it_wave4_run_q2",
          studentArtifactId: "it_wave4_art_q2",
          status: "ANALYZING",
        }),
      "23505",
      "ss_analysis_run_active_session_key",
    );
  });

  test("a terminal run does not block a later in-flight retry", async () => {
    await insertArtifact({ id: "it_wave4_art_t1", sha: sha("t001") });
    await insertArtifact({ id: "it_wave4_art_t2", sha: sha("t002") });
    await insertRun({
      id: "it_wave4_run_done",
      studentArtifactId: "it_wave4_art_t1",
      status: "SUCCEEDED",
    });
    await insertRun({
      id: "it_wave4_run_retry",
      studentArtifactId: "it_wave4_art_t2",
      status: "QUEUED",
    });
  });

  test("the same artifact object key cannot be claimed twice", async () => {
    await insertArtifact({
      id: "it_wave4_art_obj1",
      storageKey: "shared/object.wav",
    });

    await expectPgFailure(
      () =>
        insertArtifact({
          id: "it_wave4_art_obj2",
          sessionId: IDS.sessionB,
          sha: sha("obj2"),
          storageKey: "shared/object.wav",
        }),
      "23505",
      "ss_audio_artifact_object_key",
    );
  });

  test("identical bytes on the same session role cannot be registered twice", async () => {
    await insertArtifact({
      id: "it_wave4_art_dup1",
      sha: sha("dup1"),
    });

    await expectPgFailure(
      () =>
        insertArtifact({
          id: "it_wave4_art_dup2",
          sha: sha("dup1"),
        }),
      "23505",
      "ss_audio_artifact_session_role_sha_key",
    );
  });

  test("artifacts restrict destructive session deletion", async () => {
    await insertArtifact({ id: "it_wave4_art_keep" });

    await expectPgFailure(
      () =>
        setupClient!.query(
          `DELETE FROM "speaking_session" WHERE "id" = $1`,
          [IDS.sessionA],
        ),
      "23001",
      "speaking_session_audio_artifact_sessionId_fkey",
    );
  });

  test("replayed idempotency key on the same student artifact is rejected", async () => {
    await insertArtifact({ id: "it_wave4_art_idemp" });
    await insertRun({
      id: "it_wave4_run_idemp_1",
      studentArtifactId: "it_wave4_art_idemp",
      status: "SUCCEEDED",
      key: "same-request",
    });

    await expectPgFailure(
      () =>
        insertRun({
          id: "it_wave4_run_idemp_2",
          studentArtifactId: "it_wave4_art_idemp",
          status: "SUCCEEDED",
          key: "same-request",
        }),
      "23505",
      "ss_analysis_run_idempotency_key",
    );
  });

  test("terminal shape and failure-code CHECKs reject inconsistent runs", async () => {
    await insertArtifact({ id: "it_wave4_art_shape" });

    await expectPgFailure(
      () =>
        insertRun({
          id: "it_wave4_run_no_finish",
          studentArtifactId: "it_wave4_art_shape",
          status: "SUCCEEDED",
          finishedAt: null,
        }),
      "23514",
      "ss_analysis_run_terminal_shape_check",
    );

    await expectPgFailure(
      () =>
        insertRun({
          id: "it_wave4_run_queued_code",
          studentArtifactId: "it_wave4_art_shape",
          status: "QUEUED",
          failureCode: "INTERNAL",
        }),
      "23514",
      "ss_analysis_run_failure_code_check",
    );
  });

  test("artifact integrity CHECKs reject malformed hashes and empty metrics", async () => {
    await expectPgFailure(
      () =>
        insertArtifact({
          id: "it_wave4_art_bad_sha",
          sha: "not-a-sha256",
        }),
      "23514",
      "ss_audio_artifact_sha256_format_check",
    );

    await expectPgFailure(
      () =>
        insertArtifact({
          id: "it_wave4_art_zero",
          sha: sha("zero"),
          durationMs: 0,
        }),
      "23514",
      "ss_audio_artifact_positive_metrics_check",
    );
  });

  test("provenance is pinned per table", async () => {
    await insertArtifact({ id: "it_wave4_art_prov" });
    await insertRun({
      id: "it_wave4_run_prov",
      studentArtifactId: "it_wave4_art_prov",
      status: "SUCCEEDED",
    });

    await expectPgFailure(
      () =>
        setupClient!.query(
          `
            INSERT INTO "speaking_session_transcript" (
              "id", "runId", "provenance", "language", "segments", "sources",
              "studentWordCount", "studentSpeakingMs"
            )
            VALUES (
              'it_wave4_tr_bad', 'it_wave4_run_prov', 'AI_RECOMMENDATION', 'en',
              '[]'::jsonb, '[]'::jsonb, 0, 0
            )
          `,
        ),
      "23514",
      "ss_transcript_provenance_check",
    );

    await expectPgFailure(
      () =>
        setupClient!.query(
          `
            INSERT INTO "speaking_session_suggestion" (
              "id", "runId", "rank", "provenance", "priority", "kind",
              "focus", "rationale", "activity", "targetDescription"
            )
            VALUES (
              'it_wave4_sug_bad', 'it_wave4_run_prov', 1, 'AI_OBSERVATION',
              'LOW', 'RESOURCE', 'Focus', 'Why', 'Do this', 'Target'
            )
          `,
        ),
      "23514",
      "ss_suggestion_provenance_check",
    );

    await expectPgFailure(
      () =>
        setupClient!.query(
          `
            INSERT INTO "speaking_session_teacher_feedback" (
              "id", "sessionId", "authorUserId", "provenance", "body", "updatedAt"
            )
            VALUES (
              'it_wave4_fb_bad', $1, $2, 'AI_OBSERVATION',
              'Teacher note', CURRENT_TIMESTAMP
            )
          `,
          [IDS.sessionA, IDS.teacherUser],
        ),
      "23514",
      "ss_teacher_feedback_provenance_check",
    );
  });

  test("correction, level-gate, and suggestion CHECKs reject bad rows", async () => {
    await insertArtifact({ id: "it_wave4_art_chk" });
    await insertRun({
      id: "it_wave4_run_chk",
      studentArtifactId: "it_wave4_art_chk",
      status: "SUCCEEDED",
    });

    await expectPgFailure(
      () =>
        setupClient!.query(
          `
            INSERT INTO "speaking_session_correction" (
              "id", "runId", "rank", "type", "subtype", "originalText",
              "correctedText", "explanation", "transcriptSegmentIndex",
              "confidence"
            )
            VALUES (
              'it_wave4_corr_same', 'it_wave4_run_chk', 1, 'GRAMMAR_ERROR',
              'PAST_SIMPLE', 'go', 'go', 'noop', 0, 0.9
            )
          `,
        ),
      "23514",
      "ss_correction_distinct_text_check",
    );

    await setupClient!.query(
      `
        INSERT INTO "speaking_session_vocabulary_observation" (
          "id", "runId", "rank", "headword", "partOfSpeech", "status",
          "occurrenceCount", "segmentIndexes", "confidence"
        )
        VALUES (
          'it_wave4_obs_1', 'it_wave4_run_chk', 1, 'good', 'ADJECTIVE',
          'OVERUSED', 4, ARRAY[0], 0.8
        )
      `,
    );

    await expectPgFailure(
      () =>
        setupClient!.query(
          `
            INSERT INTO "speaking_session_vocabulary_alternative" (
              "id", "observationId", "rank", "suggestion", "cefrLevel",
              "maxAllowedLevel"
            )
            VALUES (
              'it_wave4_alt_c1', 'it_wave4_obs_1', 1, 'substantial', 'C1', 'B1'
            )
          `,
        ),
      "23514",
      "ss_vocabulary_alternative_level_check",
    );

    await setupClient!.query(
      `
        INSERT INTO "speaking_session_vocabulary_alternative" (
          "id", "observationId", "rank", "suggestion", "cefrLevel",
          "maxAllowedLevel"
        )
        VALUES (
          'it_wave4_alt_ok', 'it_wave4_obs_1', 1, 'effective', 'B1', 'B1'
        )
      `,
    );

    await expectPgFailure(
      () =>
        setupClient!.query(
          `
            INSERT INTO "speaking_session_suggestion" (
              "id", "runId", "rank", "priority", "kind", "focus",
              "rationale", "activity", "targetDescription"
            )
            VALUES (
              'it_wave4_sug_blank', 'it_wave4_run_chk', 1, 'LOW', 'RESOURCE',
              'Focus', '   ', 'Do this', 'Target'
            )
          `,
        ),
      "23514",
      "ss_suggestion_rationale_present_check",
    );

    await expectPgFailure(
      () =>
        setupClient!.query(
          `
            INSERT INTO "speaking_session_teacher_feedback" (
              "id", "sessionId", "authorUserId", "body", "updatedAt"
            )
            VALUES (
              'it_wave4_fb_blank', $1, $2, '   ', CURRENT_TIMESTAMP
            )
          `,
          [IDS.sessionA, IDS.teacherUser],
        ),
      "23514",
      "ss_teacher_feedback_body_check",
    );
  });

  test("observation and alternative provenance stay on different layers", async () => {
    await insertArtifact({ id: "it_wave4_art_layers" });
    await insertRun({
      id: "it_wave4_run_layers",
      studentArtifactId: "it_wave4_art_layers",
      status: "SUCCEEDED",
    });
    await setupClient!.query(
      `
        INSERT INTO "speaking_session_vocabulary_observation" (
          "id", "runId", "rank", "headword", "partOfSpeech", "status",
          "occurrenceCount", "segmentIndexes", "confidence"
        )
        VALUES (
          'it_wave4_obs_layer', 'it_wave4_run_layers', 1, 'good', 'ADJECTIVE',
          'OVERUSED', 4, ARRAY[0], 0.8
        )
      `,
    );
    await setupClient!.query(
      `
        INSERT INTO "speaking_session_vocabulary_alternative" (
          "id", "observationId", "rank", "suggestion", "cefrLevel",
          "maxAllowedLevel"
        )
        VALUES (
          'it_wave4_alt_layer', 'it_wave4_obs_layer', 1, 'effective', 'B1', 'B1'
        )
      `,
    );

    const rows = await setupClient!.query<{
      observation: string;
      alternative: string;
    }>(`
      SELECT
        o."provenance" AS observation,
        a."provenance" AS alternative
      FROM "speaking_session_vocabulary_observation" o
      JOIN "speaking_session_vocabulary_alternative" a
        ON a."observationId" = o."id"
      WHERE o."id" = 'it_wave4_obs_layer'
    `);

    expect(rows.rows[0]).toEqual({
      observation: "AI_OBSERVATION",
      alternative: "AI_RECOMMENDATION",
    });
  });
});
