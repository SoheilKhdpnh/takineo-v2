import "server-only";

/*
 * Prisma interactive transactions default to 5s timeout / 2s maxWait.
 * Talkinu’s Neon round-trips from the launch market often exceed that
 * once a compare-and-set write and discovery reconcile share one
 * transaction.
 */
export const INTERACTIVE_TRANSACTION_MAX_WAIT_MS = 10_000;
export const INTERACTIVE_TRANSACTION_TIMEOUT_MS = 30_000;

export const interactiveTransactionOptions = {
  maxWait: INTERACTIVE_TRANSACTION_MAX_WAIT_MS,
  timeout: INTERACTIVE_TRANSACTION_TIMEOUT_MS,
} as const;
