import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AdminReviewConflictError } from "@/lib/errors/admin-errors";
import { Prisma } from "@/lib/generated/prisma/client";

export async function runSerializableAdminTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await prisma.$transaction(work, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new AdminReviewConflictError();
    }
    throw error;
  }
}
