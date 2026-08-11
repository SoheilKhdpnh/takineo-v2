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

  const adapter =
    new PrismaPg({
      connectionString,
    });

  return new PrismaClient({
    adapter,
  });
}
