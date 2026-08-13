import { randomUUID } from "node:crypto";

import { Client } from "pg";

import { getTestDatabaseUrl } from "@/tests/support/test-database-url";

export const ADMIN_TEACHER_APPLICATION_STATES = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
] as const;

export type AdminTeacherApplicationState =
  (typeof ADMIN_TEACHER_APPLICATION_STATES)[number];

type ProductRole = "STUDENT" | "TEACHER";
type AccountStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";
type AdminPermission = "REVIEWER" | "SUPER_ADMIN";

export type AdminFixtureUser = {
  userId: string;
};

export type AdminFixtureTeacher = AdminFixtureUser & {
  teacherProfileId: string;
};

export type AdminFixtureAdministrator = AdminFixtureUser & {
  teacherProfileId: string | null;
};

type TestDatabaseIdentity = {
  database_name: string;
  user_name: string;
  server_address: string;
  server_port: number;
};

const SAFE_KEY = /^[a-z0-9][a-z0-9_]*$/;

function assertSafeKey(value: string, label: string): void {
  if (!SAFE_KEY.test(value)) {
    throw new Error(
      `${label} must contain only lowercase letters, digits, and underscores.`,
    );
  }
}

async function assertIsolatedTestDatabase(client: Client): Promise<void> {
  const identity = await client.query<TestDatabaseIdentity>(`
    SELECT
      current_database()::text AS database_name,
      current_user::text AS user_name,
      host(inet_server_addr())::text AS server_address,
      inet_server_port()::int AS server_port
  `);

  const database = identity.rows[0];

  if (
    !database ||
    database.database_name !== "takineo_test" ||
    database.user_name !== "takineo_test" ||
    database.server_address !== "127.0.0.1" ||
    database.server_port !== 5432
  ) {
    throw new Error(
      "Refusing administrative fixture setup: unexpected test database identity.",
    );
  }
}

export function createAdminServiceRunPrefix(suiteKey: string): string {
  assertSafeKey(suiteKey, "Administrative fixture suite key");

  const runId = randomUUID().replaceAll("-", "").slice(0, 12);

  return `it_admin_${suiteKey}_${runId}`;
}

export class AdminServiceFixtures {
  readonly prefix: string;

  private client: Client | null = null;

  constructor(suiteKey: string) {
    this.prefix = createAdminServiceRunPrefix(suiteKey);
  }

  id(key: string): string {
    assertSafeKey(key, "Administrative fixture key");
    return `${this.prefix}_${key}`;
  }

  async connect(applicationName: string): Promise<void> {
    if (this.client) {
      throw new Error("Administrative fixtures are already connected.");
    }

    const client = new Client({
      connectionString: getTestDatabaseUrl(),
      application_name: applicationName,
    });

    await client.connect();

    try {
      await assertIsolatedTestDatabase(client);
      this.client = client;
      await this.cleanup();
    } catch (error) {
      this.client = null;
      await client.end();
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    const client = this.requireClient();

    // Preserve foreign-key cleanup order for every prefix-scoped fixture set.
    await client.query(
      `DELETE FROM "admin_access"
       WHERE left("userId", length($1)) = $1`,
      [this.prefix],
    );
    await client.query(
      `DELETE FROM "teacher_profile"
       WHERE left("userId", length($1)) = $1`,
      [this.prefix],
    );
    await client.query(
      `DELETE FROM "user"
       WHERE left("id", length($1)) = $1`,
      [this.prefix],
    );
  }

  async dispose(): Promise<void> {
    const client = this.client;
    if (!client) return;

    try {
      await this.cleanup();
    } finally {
      this.client = null;
      await client.end();
    }
  }

  async createUser(input: {
    key: string;
    role: ProductRole;
    accountStatus?: AccountStatus;
  }): Promise<AdminFixtureUser> {
    const userId = this.id(input.key);

    await this.requireClient().query(
      `INSERT INTO "user" (
         "id", "name", "email", "emailVerified", "role",
         "accountStatus", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, true, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        userId,
        `Admin service fixture ${userId}`,
        `${userId}@example.test`,
        input.role,
        input.accountStatus ?? "ACTIVE",
      ],
    );

    return { userId };
  }

  async createTeacherApplicant(input: {
    key: string;
    applicationStatus: AdminTeacherApplicationState;
    accountStatus?: AccountStatus;
  }): Promise<AdminFixtureTeacher> {
    const user = await this.createUser({
      key: input.key,
      role: "TEACHER",
      accountStatus: input.accountStatus,
    });
    const teacherProfileId = this.id(`${input.key}_profile`);

    await this.insertTeacherProfile(
      user.userId,
      teacherProfileId,
      input.applicationStatus,
    );

    return { ...user, teacherProfileId };
  }

  async createAdministrator(input: {
    key: string;
    permission: AdminPermission;
    productRole?: ProductRole;
    accountStatus?: AccountStatus;
    revoked?: boolean;
    teacherApplicationStatus?: AdminTeacherApplicationState;
  }): Promise<AdminFixtureAdministrator> {
    const productRole = input.productRole ?? "STUDENT";

    if (input.teacherApplicationStatus && productRole !== "TEACHER") {
      throw new Error(
        "A teacher application state requires the TEACHER product role.",
      );
    }

    const user = await this.createUser({
      key: input.key,
      role: productRole,
      accountStatus: input.accountStatus,
    });
    const teacherProfileId = input.teacherApplicationStatus
      ? this.id(`${input.key}_profile`)
      : null;

    if (teacherProfileId && input.teacherApplicationStatus) {
      await this.insertTeacherProfile(
        user.userId,
        teacherProfileId,
        input.teacherApplicationStatus,
      );
    }

    await this.requireClient().query(
      `INSERT INTO "admin_access" (
         "id", "userId", "permission", "revokedAt", "createdAt", "updatedAt"
       ) VALUES (
         $1, $2, $3,
         CASE WHEN $4::boolean THEN CURRENT_TIMESTAMP ELSE NULL END,
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       )`,
      [
        this.id(`${input.key}_access`),
        user.userId,
        input.permission,
        input.revoked ?? false,
      ],
    );

    return { ...user, teacherProfileId };
  }

  private requireClient(): Client {
    if (!this.client) {
      throw new Error("Administrative fixture client is unavailable.");
    }
    return this.client;
  }

  private async insertTeacherProfile(
    userId: string,
    teacherProfileId: string,
    applicationStatus: AdminTeacherApplicationState,
  ): Promise<void> {
    await this.requireClient().query(
      `INSERT INTO "teacher_profile" (
         "id", "userId", "applicationStatus", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [teacherProfileId, userId, applicationStatus],
    );
  }
}

export function createAdminServiceFixtures(
  suiteKey: string,
): AdminServiceFixtures {
  return new AdminServiceFixtures(suiteKey);
}
