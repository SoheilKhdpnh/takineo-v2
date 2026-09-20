import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import {
  Client,
} from "pg";

import {
  getTestDatabaseUrl,
} from "@/tests/support/test-database-url";

const connectionString = getTestDatabaseUrl();

let setupClient: Client | null = null;

const IDS = {
  teacherUser: "it_wave3_review_teacher_user",
  teacherProfile: "it_wave3_review_teacher_profile",
  studentUser: "it_wave3_review_student_user",
  session: "it_wave3_review_session",
  review: "it_wave3_review_row",
} as const;

type PgFailure = Error & {
  code?: string;
  constraint?: string;
};

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

async function cleanupFixtures() {
  if (!setupClient) {
    return;
  }

  await setupClient.query(`
    DELETE FROM "session_review"
    WHERE
      "id" LIKE 'it_wave3_review_%'
      OR "sessionId" LIKE 'it_wave3_review_%'
  `);

  await setupClient.query(`
    DELETE FROM "speaking_session"
    WHERE "id" LIKE 'it_wave3_review_%'
  `);

  await setupClient.query(`
    DELETE FROM "teacher_profile"
    WHERE "id" LIKE 'it_wave3_review_%'
  `);

  await setupClient.query(`
    DELETE FROM "user"
    WHERE "id" LIKE 'it_wave3_review_%'
  `);
}

async function seedSessionFixture() {
  if (!setupClient) {
    throw new Error("Integration setup client is unavailable.");
  }

  await setupClient.query(
    `
      INSERT INTO "user" (
        "id",
        "name",
        "email",
        "emailVerified",
        "role",
        "accountStatus",
        "createdAt",
        "updatedAt"
      )
      VALUES
        (
          $1,
          'Wave 3 Review Teacher',
          'wave3-review-teacher@example.test',
          true,
          'TEACHER',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        ),
        (
          $2,
          'Wave 3 Review Student',
          'wave3-review-student@example.test',
          true,
          'STUDENT',
          'ACTIVE',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
    `,
    [IDS.teacherUser, IDS.studentUser],
  );

  await setupClient.query(
    `
      INSERT INTO "teacher_profile" (
        "id",
        "userId",
        "profileCompletedAt",
        "applicationStatus",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        CURRENT_TIMESTAMP,
        'APPROVED',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [IDS.teacherProfile, IDS.teacherUser],
  );

  await setupClient.query(
    `
      INSERT INTO "speaking_session" (
        "id",
        "teacherProfileId",
        "studentUserId",
        "startAt",
        "endAt",
        "status",
        "bookingIdempotencyKey",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        $3,
        '2026-09-01T05:30:00Z'::timestamptz,
        '2026-09-01T05:45:00Z'::timestamptz,
        'SCHEDULED',
        'wave3-review-fixture',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [IDS.session, IDS.teacherProfile, IDS.studentUser],
  );
}

async function insertReview(
  options: {
    id?: string;
    sessionId?: string;
    studentUserId?: string;
    teacherUserId?: string;
    rating?: number;
    comment?: string | null;
  } = {},
) {
  if (!setupClient) {
    throw new Error("Database client is unavailable.");
  }

  return setupClient.query(
    `
      INSERT INTO "session_review" (
        "id",
        "sessionId",
        "studentUserId",
        "teacherUserId",
        "rating",
        "comment"
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      options.id ?? IDS.review,
      options.sessionId ?? IDS.session,
      options.studentUserId ?? IDS.studentUser,
      options.teacherUserId ?? IDS.teacherUser,
      options.rating ?? 5,
      options.comment ?? null,
    ],
  );
}

describe("Wave 3 session-review database constraints", () => {
  beforeAll(async () => {
    setupClient = new Client({
      connectionString,
      application_name: "takineo-wave3-session-review-constraints",
    });
    await setupClient.connect();
  });

  beforeEach(async () => {
    await cleanupFixtures();
    await seedSessionFixture();
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures();
    await setupClient?.end();
    setupClient = null;
  });

  test("a second review for the same speaking session is a unique-index conflict", async () => {
    await insertReview();

    await expectPgFailure(
      () =>
        insertReview({
          id: "it_wave3_review_duplicate",
          rating: 4,
          comment: "Second attempt",
        }),
      "23505",
      "session_review_sessionId_key",
    );
  });

  test("a review cannot be stored against a missing speaking session", async () => {
    await expectPgFailure(
      () =>
        insertReview({
          sessionId: "it_wave3_review_missing_session",
        }),
      "23503",
      "session_review_sessionId_fkey",
    );
  });

  test("deleting a reviewed speaking session is restricted by the review foreign key", async () => {
    await insertReview();

    const failure = await expectPgFailure(
      () =>
        setupClient!.query(
          `DELETE FROM "speaking_session" WHERE "id" = $1`,
          [IDS.session],
        ),
      "23001",
      "session_review_sessionId_fkey",
    );

    expect(failure.constraint).toBe("session_review_sessionId_fkey");
  });
});
