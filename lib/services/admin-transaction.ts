import "server-only";

import {
  AdminReviewConflictError,
} from "@/lib/errors/admin-errors";
import {
  Prisma,
} from "@/lib/generated/prisma/client";
import {
  runSerializableTransaction,
} from "@/lib/services/serializable-transaction";

export async function runSerializableAdminTransaction<T>(
  work: (
    tx: Prisma.TransactionClient,
  ) => Promise<T>,
): Promise<T> {
  return runSerializableTransaction(
    work,
    {
      /*
       * Preserve Wave 1 semantics:
       * admin review conflicts are surfaced
       * immediately rather than retried.
       */
      maxAttempts: 1,

      conflictErrorFactory:
        () =>
          new AdminReviewConflictError(),
    },
  );
}
