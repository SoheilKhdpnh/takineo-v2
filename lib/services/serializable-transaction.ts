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

type PrismaKnownRequestErrorShape = {
  name?: unknown;
  code?: unknown;
  meta?: unknown;
};

/*
 * PostgreSQL transaction-level failures that
 * require retrying the entire transaction.
 *
 * 40001 = serialization_failure
 * 40P01 = deadlock_detected
 */
const RETRYABLE_POSTGRES_TRANSACTION_CODES =
  new Set([
    "40001",
    "40P01",
  ]);

function isObject(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null
  );
}

function isPrismaKnownRequestError(
  error: unknown,
): error is PrismaKnownRequestErrorShape {
  if (
    !isObject(
      error,
    )
  ) {
    return false;
  }

  /*
   * Normal production path.
   */
  if (
    error instanceof
      Prisma.PrismaClientKnownRequestError
  ) {
    return true;
  }

  /*
   * Constructor identity can differ across
   * isolated module graphs.
   *
   * Keep the fallback deliberately narrow.
   */
  return (
    error.name ===
      "PrismaClientKnownRequestError" &&
    typeof error.code ===
      "string"
  );
}

function getPostgresErrorCodeFromMeta(
  meta: unknown,
): string | null {
  if (
    !isObject(
      meta,
    )
  ) {
    return null;
  }

  /*
   * Older / non-driver-adapter Prisma raw
   * query representation:
   *
   * meta.code = "40001"
   */
  if (
    typeof meta.code ===
      "string"
  ) {
    return meta.code;
  }

  /*
   * Prisma 7 + driver adapter representation:
   *
   * meta.driverAdapterError.cause.originalCode
   *   = "40001"
   */
  const driverAdapterError =
    meta.driverAdapterError;

  if (
    !isObject(
      driverAdapterError,
    )
  ) {
    return null;
  }

  const cause =
    driverAdapterError.cause;

  if (
    !isObject(
      cause,
    )
  ) {
    return null;
  }

  if (
    typeof cause.originalCode ===
      "string"
  ) {
    return cause.originalCode;
  }

  return null;
}

function isRetryableTransactionConflict(
  error: unknown,
): boolean {
  if (
    !isPrismaKnownRequestError(
      error,
    )
  ) {
    return false;
  }

  /*
   * Prisma's normal transaction-conflict /
   * deadlock representation.
   */
  if (
    error.code ===
    "P2034"
  ) {
    return true;
  }

  if (
    error.code !==
    "P2010"
  ) {
    return false;
  }

  const postgresCode =
    getPostgresErrorCodeFromMeta(
      error.meta,
    );

  return (
    postgresCode !==
      null &&
    RETRYABLE_POSTGRES_TRANSACTION_CODES.has(
      postgresCode,
    )
  );
}

export async function runSerializableTransaction<T>(
  work: (
    tx:
      Prisma.TransactionClient,
  ) => Promise<T>,
  options:
    SerializableTransactionOptions = {},
): Promise<T> {
  const maxAttempts =
    options.maxAttempts ??
    1;

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
        !isRetryableTransactionConflict(
          error,
        )
      ) {
        throw error;
      }

      if (
        attempt <
        maxAttempts
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