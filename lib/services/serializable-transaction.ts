import "server-only";

import {
  prisma,
} from "@/lib/db/prisma";
import {
  Prisma,
} from "@/lib/generated/prisma/client";

export type SerializableTransactionOptions = {
  maxAttempts?: number;
  conflictErrorFactory?: () => Error;
};

function isSerializableConflict(
  error: unknown,
): boolean {
  return (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

export async function runSerializableTransaction<T>(
  work: (
    tx: Prisma.TransactionClient,
  ) => Promise<T>,
  options:
    SerializableTransactionOptions = {},
): Promise<T> {
  const maxAttempts =
    options.maxAttempts ?? 1;

  if (
    !Number.isInteger(
      maxAttempts,
    ) ||
    maxAttempts < 1 ||
    maxAttempts > 5
  ) {
    throw new Error(
      "maxAttempts must be an integer between 1 and 5.",
    );
  }

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt += 1
  ) {
    try {
      return await prisma.$transaction(
        work,
        {
          isolationLevel:
            "Serializable",
        },
      );
    } catch (error) {
      if (
        !isSerializableConflict(
          error,
        )
      ) {
        throw error;
      }

      if (
        attempt < maxAttempts
      ) {
        continue;
      }

      if (
        options
          .conflictErrorFactory
      ) {
        throw options
          .conflictErrorFactory();
      }

      throw error;
    }
  }

  throw new Error(
    "Serializable transaction exhausted unexpectedly.",
  );
}
