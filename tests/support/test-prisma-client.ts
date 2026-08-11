import {
  PrismaPg,
} from "@prisma/adapter-pg";

import {
  PrismaClient,
} from "@/lib/generated/prisma/client";
import {
  getTestDatabaseUrl,
} from "@/tests/support/test-database-url";

export function createTestPrismaClient():
  PrismaClient {
  const connectionString =
    getTestDatabaseUrl();

  /*
   * Keep PostgreSQL driver-adapter sessions in
   * UTC.
   *
   * SpeakingSession timestamps represent
   * absolute instants. Their persistence must
   * therefore not depend on the PostgreSQL
   * server/session timezone.
   *
   * This also avoids known @prisma/adapter-pg
   * TIMESTAMPTZ behavior on non-UTC sessions.
   */
  const adapter =
    new PrismaPg({
      connectionString,

      options:
        "-c timezone=UTC",
    });

  return new PrismaClient({
    adapter,
  });
}