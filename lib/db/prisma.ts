import "server-only";

import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "@/lib/generated/prisma/client";
import { serverEnv } from "@/lib/env/server";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

<<<<<<< HEAD
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaNeon({
    connectionString: serverEnv.DATABASE_URL,
=======
const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL!,
});

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: serverEnv.DIRECT_URL,
>>>>>>> origin/main
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