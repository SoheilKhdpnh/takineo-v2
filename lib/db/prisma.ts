import "server-only";

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";
import { serverEnv } from "@/lib/env/server";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  if (process.env.TAKINEO_E2E_RUNTIME === "1") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "E2E database runtime is forbidden in production.",
      );
    }

    if (process.env.PLAYWRIGHT_TEST !== "1") {
      throw new Error(
        "E2E database runtime requires the Playwright test process.",
      );
    }

    const e2eDatabaseUrl =
      process.env.E2E_DATABASE_URL?.trim();

    if (
      !e2eDatabaseUrl ||
      serverEnv.DATABASE_URL !== e2eDatabaseUrl
    ) {
      throw new Error(
        "E2E database runtime requires DATABASE_URL to equal E2E_DATABASE_URL.",
      );
    }

    const parsed = new URL(e2eDatabaseUrl);

    if (
      parsed.protocol !== "postgresql:" ||
      parsed.hostname !== "127.0.0.1" ||
      parsed.port !== "5432" ||
      decodeURIComponent(parsed.username) !==
        "takineo_e2e" ||
      decodeURIComponent(
        parsed.pathname.replace(/^\//, ""),
      ) !== "takineo_e2e" ||
      !parsed.password
    ) {
      throw new Error(
        "E2E database runtime refused a noncanonical database identity.",
      );
    }

    if (
      process.env.TEST_DATABASE_URL &&
      new URL(process.env.TEST_DATABASE_URL).toString() ===
        parsed.toString()
    ) {
      throw new Error(
        "E2E database runtime must not reuse TEST_DATABASE_URL.",
      );
    }

    const adapter = new PrismaPg({
      connectionString: e2eDatabaseUrl,
      options: "-c timezone=UTC",
    });

    return new PrismaClient({ adapter });
  }

  const adapter = new PrismaNeon({
    connectionString: serverEnv.DATABASE_URL,
  });

  return new PrismaClient({
    adapter,
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}