import {
  afterAll,
  afterEach,
  beforeAll,
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

const connectionString =
  getTestDatabaseUrl();

let setupClient: Client | null = null;

async function createClient(
  applicationName: string,
): Promise<Client> {
  const client = new Client({
    connectionString,
    application_name:
      applicationName,
  });

  await client.connect();

  return client;
}

function postgresErrorCode(
  error: unknown,
): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (
      error as {
        code?: unknown;
      }
    ).code === "string"
  ) {
    return (
      error as {
        code: string;
      }
    ).code;
  }

  return undefined;
}

async function cleanupFixtures() {
  if (!setupClient) {
    return;
  }

  await setupClient.query(`
    DELETE FROM "mux_playback_reconciliation"
    WHERE "id" LIKE 'it_concurrency_%'
  `);

  await setupClient.query(`
    DELETE FROM "teacher_intro_video"
    WHERE "id" LIKE 'it_concurrency_%'
  `);

  await setupClient.query(`
    DELETE FROM "teacher_profile"
    WHERE "id" LIKE 'it_concurrency_%'
  `);

  await setupClient.query(`
    DELETE FROM "admin_access"
    WHERE "id" LIKE 'it_concurrency_%'
       OR "userId" LIKE 'it_concurrency_%'
  `);

  await setupClient.query(`
    DELETE FROM "user"
    WHERE "id" LIKE 'it_concurrency_%'
  `);
}

async function seedMuxFixture(
  suffix: string,
) {
  if (!setupClient) {
    throw new Error(
      "Integration setup client is unavailable.",
    );
  }

  const userId =
    `it_concurrency_user_${suffix}`;

  const profileId =
    `it_concurrency_profile_${suffix}`;

  const videoId =
    `it_concurrency_video_${suffix}`;

  const reconciliationId =
    `it_concurrency_reconciliation_${suffix}`;

  const uploadId =
    `upload_concurrency_${suffix}`;

  const assetId =
    `asset_concurrency_${suffix}`;

  await setupClient.query(
    `
      INSERT INTO "user" (
        "id",
        "name",
        "email",
        "emailVerified",
        "createdAt",
        "updatedAt",
        "role",
        "onboardingCompletedAt",
        "accountStatus"
      )
      VALUES (
        $1,
        $2,
        $3,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        'TEACHER',
        CURRENT_TIMESTAMP,
        'ACTIVE'
      )
    `,
    [
      userId,
      `Concurrency Teacher ${suffix}`,
      `${suffix}@concurrency.example.test`,
    ],
  );

  await setupClient.query(
    `
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
        "applicationStatus"
      )
      VALUES (
        $1,
        $2,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        'Concurrency integration fixture.',
        5,
        'Concurrency teacher',
        'fa',
        CURRENT_TIMESTAMP,
        'en',
        'Asia/Tehran',
        'APPROVED'
      )
    `,
    [
      profileId,
      userId,
    ],
  );

  await setupClient.query(
    `
      INSERT INTO "teacher_intro_video" (
        "id",
        "teacherProfileId",
        "provider",
        "uploadId",
        "assetId",
        "publicPlaybackId",
        "status",
        "durationSeconds",
        "revision",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        'mux',
        $3,
        $4,
        NULL,
        'APPROVED',
        90,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [
      videoId,
      profileId,
      uploadId,
      assetId,
    ],
  );

  await setupClient.query(
    `
      INSERT INTO "mux_playback_reconciliation" (
        "id",
        "introVideoId",
        "videoRevision",
        "assetId",
        "playbackId",
        "desiredState",
        "intentGeneration",
        "status",
        "attemptCount",
        "nextAttemptAt",
        "leaseToken",
        "leaseExpiresAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        1,
        $3,
        NULL,
        'ENABLED',
        1,
        'PENDING',
        0,
        CURRENT_TIMESTAMP - INTERVAL '1 second',
        NULL,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [
      reconciliationId,
      videoId,
      assetId,
    ],
  );

  return {
    userId,
    profileId,
    videoId,
    reconciliationId,
    assetId,
  };
}

async function seedSuperAdmins() {
  if (!setupClient) {
    throw new Error(
      "Integration setup client is unavailable.",
    );
  }

  const firstUser =
    "it_concurrency_admin_user_a";

  const secondUser =
    "it_concurrency_admin_user_b";

  await setupClient.query(
    `
      INSERT INTO "user" (
        "id",
        "name",
        "email",
        "emailVerified",
        "createdAt",
        "updatedAt",
        "role",
        "accountStatus"
      )
      VALUES
        (
          $1,
          'Concurrency Admin A',
          'concurrency-admin-a@example.test',
          true,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          'STUDENT',
          'ACTIVE'
        ),
        (
          $2,
          'Concurrency Admin B',
          'concurrency-admin-b@example.test',
          true,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          'STUDENT',
          'ACTIVE'
        )
    `,
    [
      firstUser,
      secondUser,
    ],
  );

  await setupClient.query(
    `
      INSERT INTO "admin_access" (
        "id",
        "userId",
        "permission",
        "createdAt",
        "updatedAt",
        "revokedAt"
      )
      VALUES
        (
          'it_concurrency_admin_access_a',
          $1,
          'SUPER_ADMIN',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          NULL
        ),
        (
          'it_concurrency_admin_access_b',
          $2,
          'SUPER_ADMIN',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          NULL
        )
    `,
    [
      firstUser,
      secondUser,
    ],
  );

  return {
    firstUser,
    secondUser,
  };
}

async function activeSuperAdminCount(
  client: Client,
): Promise<number> {
  const result = await client.query<{
    count: number;
  }>(`
    SELECT COUNT(*)::int AS count
    FROM "admin_access" aa
    JOIN "user" u
      ON u."id" = aa."userId"
    WHERE
      aa."permission" = 'SUPER_ADMIN'
      AND aa."revokedAt" IS NULL
      AND u."accountStatus" = 'ACTIVE'
  `);

  return result.rows[0]?.count ?? -1;
}

describe.sequential(
  "Wave 1 real PostgreSQL concurrency",
  () => {
    beforeAll(async () => {
      setupClient =
        await createClient(
          "takineo-wave1-concurrency-setup",
        );

      const identity =
        await setupClient.query<{
          database_name: string;
          user_name: string;
          server_address: string;
          server_port: number;
        }>(`
          SELECT
            current_database()::text
              AS database_name,
            current_user::text
              AS user_name,
            host(
              inet_server_addr()
            )::text
              AS server_address,
            inet_server_port()::int
              AS server_port
        `);

      const row =
        identity.rows[0];

      expect(row).toEqual({
        database_name:
          "takineo_test",
        user_name:
          "takineo_test",
        server_address:
          "127.0.0.1",
        server_port: 5432,
      });

      const wave1 =
        await setupClient.query<{
          account_status: boolean;
          reconciliation: boolean;
        }>(`
          SELECT
            EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE
                table_schema = 'public'
                AND table_name = 'user'
                AND column_name = 'accountStatus'
            ) AS account_status,

            to_regclass(
              'public.mux_playback_reconciliation'
            ) IS NOT NULL
              AS reconciliation
        `);

      expect(
        wave1.rows[0],
      ).toEqual({
        account_status: true,
        reconciliation: true,
      });
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

    test(
      "only one worker can claim the same available reconciliation lease",
      async () => {
        const fixture =
          await seedMuxFixture(
            "claim",
          );

        const workerA =
          await createClient(
            "takineo-worker-a",
          );

        const workerB =
          await createClient(
            "takineo-worker-b",
          );

        try {
          const claimSql = `
            UPDATE "mux_playback_reconciliation"
            SET
              "status" = 'PROCESSING',
              "attemptCount" =
                "attemptCount" + 1,
              "lastAttemptAt" =
                CURRENT_TIMESTAMP,
              "leaseToken" = $2,
              "leaseExpiresAt" =
                CURRENT_TIMESTAMP
                + INTERVAL '60 seconds',
              "lastErrorCode" = NULL,
              "updatedAt" =
                CURRENT_TIMESTAMP
            WHERE
              "id" = $1
              AND "intentGeneration" = 1
              AND "nextAttemptAt"
                <= CURRENT_TIMESTAMP
              AND "status" IN (
                'PENDING',
                'FAILED',
                'PROCESSING',
                'SUCCEEDED'
              )
              AND (
                "leaseToken" IS NULL
                OR "leaseExpiresAt"
                  IS NULL
                OR "leaseExpiresAt"
                  <= CURRENT_TIMESTAMP
              )
            RETURNING
              "leaseToken"
          `;

          const [
            resultA,
            resultB,
          ] = await Promise.all([
            workerA.query(
              claimSql,
              [
                fixture.reconciliationId,
                "worker-a-lease",
              ],
            ),
            workerB.query(
              claimSql,
              [
                fixture.reconciliationId,
                "worker-b-lease",
              ],
            ),
          ]);

          const claimedRows =
            (resultA.rowCount ?? 0) +
            (resultB.rowCount ?? 0);

          expect(
            claimedRows,
          ).toBe(1);

          const stored =
            await setupClient!.query<{
              status: string;
              attemptCount: number;
              leaseToken: string | null;
            }>(
              `
                SELECT
                  "status",
                  "attemptCount",
                  "leaseToken"
                FROM
                  "mux_playback_reconciliation"
                WHERE "id" = $1
              `,
              [
                fixture.reconciliationId,
              ],
            );

          expect(
            stored.rows[0]?.status,
          ).toBe(
            "PROCESSING",
          );

          expect(
            stored.rows[0]
              ?.attemptCount,
          ).toBe(1);

          expect([
            "worker-a-lease",
            "worker-b-lease",
          ]).toContain(
            stored.rows[0]
              ?.leaseToken,
          );
        } finally {
          await workerA.end();
          await workerB.end();
        }
      },
    );

    test(
      "an active lease blocks competitors and an expired lease is recoverable by exactly one worker",
      async () => {
        const fixture =
          await seedMuxFixture(
            "expiry",
          );

        await setupClient!.query(
          `
            UPDATE
              "mux_playback_reconciliation"
            SET
              "status" = 'PROCESSING',
              "attemptCount" = 1,
              "leaseToken" =
                'original-worker',
              "leaseExpiresAt" =
                CURRENT_TIMESTAMP
                + INTERVAL '60 seconds',
              "updatedAt" =
                CURRENT_TIMESTAMP
            WHERE "id" = $1
          `,
          [
            fixture.reconciliationId,
          ],
        );

        const blocked =
          await setupClient!.query(
            `
              UPDATE
                "mux_playback_reconciliation"
              SET
                "leaseToken" =
                  'should-not-win',
                "attemptCount" =
                  "attemptCount" + 1
              WHERE
                "id" = $1
                AND
                "intentGeneration" = 1
                AND "status" IN (
                  'PENDING',
                  'FAILED',
                  'PROCESSING',
                  'SUCCEEDED'
                )
                AND (
                  "leaseToken" IS NULL
                  OR "leaseExpiresAt"
                    IS NULL
                  OR "leaseExpiresAt"
                    <= CURRENT_TIMESTAMP
                )
            `,
            [
              fixture.reconciliationId,
            ],
          );

        expect(
          blocked.rowCount,
        ).toBe(0);

        await setupClient!.query(
          `
            UPDATE
              "mux_playback_reconciliation"
            SET
              "leaseExpiresAt" =
                CURRENT_TIMESTAMP
                - INTERVAL '1 second'
            WHERE "id" = $1
          `,
          [
            fixture.reconciliationId,
          ],
        );

        const workerA =
          await createClient(
            "takineo-expiry-worker-a",
          );

        const workerB =
          await createClient(
            "takineo-expiry-worker-b",
          );

        try {
          const recoverySql = `
            UPDATE
              "mux_playback_reconciliation"
            SET
              "status" = 'PROCESSING',
              "attemptCount" =
                "attemptCount" + 1,
              "leaseToken" = $2,
              "leaseExpiresAt" =
                CURRENT_TIMESTAMP
                + INTERVAL '60 seconds',
              "lastAttemptAt" =
                CURRENT_TIMESTAMP,
              "updatedAt" =
                CURRENT_TIMESTAMP
            WHERE
              "id" = $1
              AND
              "intentGeneration" = 1
              AND "status" IN (
                'PENDING',
                'FAILED',
                'PROCESSING',
                'SUCCEEDED'
              )
              AND (
                "leaseToken" IS NULL
                OR "leaseExpiresAt"
                  IS NULL
                OR "leaseExpiresAt"
                  <= CURRENT_TIMESTAMP
              )
            RETURNING
              "leaseToken"
          `;

          const [
            resultA,
            resultB,
          ] = await Promise.all([
            workerA.query(
              recoverySql,
              [
                fixture.reconciliationId,
                "recovery-worker-a",
              ],
            ),
            workerB.query(
              recoverySql,
              [
                fixture.reconciliationId,
                "recovery-worker-b",
              ],
            ),
          ]);

          expect(
            (resultA.rowCount ?? 0) +
              (resultB.rowCount ?? 0),
          ).toBe(1);

          const stored =
            await setupClient!.query<{
              attemptCount: number;
              leaseToken: string | null;
            }>(
              `
                SELECT
                  "attemptCount",
                  "leaseToken"
                FROM
                  "mux_playback_reconciliation"
                WHERE "id" = $1
              `,
              [
                fixture.reconciliationId,
              ],
            );

          expect(
            stored.rows[0]
              ?.attemptCount,
          ).toBe(2);

          expect([
            "recovery-worker-a",
            "recovery-worker-b",
          ]).toContain(
            stored.rows[0]
              ?.leaseToken,
          );
        } finally {
          await workerA.end();
          await workerB.end();
        }
      },
    );

    test(
      "a superseded worker cannot finalize an older intent generation",
      async () => {
        const fixture =
          await seedMuxFixture(
            "generation",
          );

        await setupClient!.query(
          `
            UPDATE
              "mux_playback_reconciliation"
            SET
              "intentGeneration" = 3,
              "status" =
                'PROCESSING',
              "attemptCount" = 1,
              "leaseToken" =
                'old-worker-lease',
              "leaseExpiresAt" =
                CURRENT_TIMESTAMP
                + INTERVAL '60 seconds',
              "updatedAt" =
                CURRENT_TIMESTAMP
            WHERE "id" = $1
          `,
          [
            fixture.reconciliationId,
          ],
        );

        /*
         * Simulate queueMuxPlaybackIntent
         * superseding the running worker.
         */
        await setupClient!.query(
          `
            UPDATE
              "mux_playback_reconciliation"
            SET
              "desiredState" =
                'REVOKED',
              "intentGeneration" =
                "intentGeneration" + 1,
              "status" = 'PENDING',
              "attemptCount" = 0,
              "nextAttemptAt" =
                CURRENT_TIMESTAMP,
              "leaseToken" = NULL,
              "leaseExpiresAt" = NULL,
              "lastErrorCode" = NULL,
              "updatedAt" =
                CURRENT_TIMESTAMP
            WHERE "id" = $1
          `,
          [
            fixture.reconciliationId,
          ],
        );

        /*
         * Old worker tries to finalize
         * generation 3 after generation 4
         * has replaced it.
         */
        const staleFinalize =
          await setupClient!.query(
            `
              UPDATE
                "mux_playback_reconciliation"
              SET
                "playbackId" =
                  'stale-public-id',
                "status" =
                  'SUCCEEDED',
                "leaseToken" = NULL,
                "leaseExpiresAt" = NULL,
                "updatedAt" =
                  CURRENT_TIMESTAMP
              WHERE
                "id" = $1
                AND
                "intentGeneration" = 3
                AND
                "videoRevision" = 1
                AND
                "leaseToken" =
                  'old-worker-lease'
                AND
                "status" =
                  'PROCESSING'
            `,
            [
              fixture.reconciliationId,
            ],
          );

        expect(
          staleFinalize.rowCount,
        ).toBe(0);

        const current =
          await setupClient!.query<{
            desiredState: string;
            intentGeneration: number;
            status: string;
            playbackId: string | null;
            leaseToken: string | null;
          }>(
            `
              SELECT
                "desiredState",
                "intentGeneration",
                "status",
                "playbackId",
                "leaseToken"
              FROM
                "mux_playback_reconciliation"
              WHERE "id" = $1
            `,
            [
              fixture.reconciliationId,
            ],
          );

        expect(
          current.rows[0],
        ).toMatchObject({
          desiredState:
            "REVOKED",
          intentGeneration: 4,
          status: "PENDING",
          playbackId: null,
          leaseToken: null,
        });
      },
    );

    test(
      "serializable concurrent removal cannot eliminate both active SUPER_ADMIN accounts",
      async () => {
        const {
          firstUser,
          secondUser,
        } =
          await seedSuperAdmins();

        const transactionA =
          await createClient(
            "takineo-super-admin-race-a",
          );

        const transactionB =
          await createClient(
            "takineo-super-admin-race-b",
          );

        try {
          await Promise.all([
            transactionA.query(
              "BEGIN ISOLATION LEVEL SERIALIZABLE",
            ),
            transactionB.query(
              "BEGIN ISOLATION LEVEL SERIALIZABLE",
            ),
          ]);

          const [
            countA,
            countB,
          ] = await Promise.all([
            activeSuperAdminCount(
              transactionA,
            ),
            activeSuperAdminCount(
              transactionB,
            ),
          ]);

          expect(countA).toBe(2);
          expect(countB).toBe(2);

          const updates =
            await Promise.allSettled([
              transactionA.query(
                `
                  UPDATE
                    "admin_access"
                  SET
                    "revokedAt" =
                      CURRENT_TIMESTAMP,
                    "updatedAt" =
                      CURRENT_TIMESTAMP
                  WHERE
                    "userId" = $1
                    AND
                    "permission" =
                      'SUPER_ADMIN'
                    AND
                    "revokedAt"
                      IS NULL
                `,
                [
                  firstUser,
                ],
              ),
              transactionB.query(
                `
                  UPDATE
                    "admin_access"
                  SET
                    "revokedAt" =
                      CURRENT_TIMESTAMP,
                    "updatedAt" =
                      CURRENT_TIMESTAMP
                  WHERE
                    "userId" = $1
                    AND
                    "permission" =
                      'SUPER_ADMIN'
                    AND
                    "revokedAt"
                      IS NULL
                `,
                [
                  secondUser,
                ],
              ),
            ]);

          let serializationFailures =
            0;

          let committedTransactions =
            0;

          const clients = [
            transactionA,
            transactionB,
          ];

          for (
            let index = 0;
            index < updates.length;
            index += 1
          ) {
            const result =
              updates[index];

            const client =
              clients[index];

            if (
              !result ||
              !client
            ) {
              throw new Error(
                "Missing concurrency transaction result.",
              );
            }

            if (
              result.status ===
              "rejected"
            ) {
              expect(
                postgresErrorCode(
                  result.reason,
                ),
              ).toBe("40001");

              serializationFailures +=
                1;

              await client.query(
                "ROLLBACK",
              );

              continue;
            }

            try {
              await client.query(
                "COMMIT",
              );

              committedTransactions +=
                1;
            } catch (error) {
              expect(
                postgresErrorCode(
                  error,
                ),
              ).toBe("40001");

              serializationFailures +=
                1;

              try {
                await client.query(
                  "ROLLBACK",
                );
              } catch {
                // Transaction already aborted.
              }
            }
          }

          expect(
            serializationFailures,
          ).toBeGreaterThanOrEqual(
            1,
          );

          expect(
            committedTransactions,
          ).toBe(1);

          expect(
            await activeSuperAdminCount(
              setupClient!,
            ),
          ).toBe(1);
        } finally {
          /*
           * Harmless when a transaction
           * already committed/rolled back.
           */
          try {
            await transactionA.query(
              "ROLLBACK",
            );
          } catch {
            // Ignore cleanup error.
          }

          try {
            await transactionB.query(
              "ROLLBACK",
            );
          } catch {
            // Ignore cleanup error.
          }

          await transactionA.end();
          await transactionB.end();
        }
      },
      15_000,
    );
  },
);
