import "server-only";

export const INTERACTIVE_TRANSACTION_MAX_WAIT_MS = 10_000;
export const INTERACTIVE_TRANSACTION_TIMEOUT_MS = 30_000;

export const interactiveTransactionOptions = {
  maxWait: INTERACTIVE_TRANSACTION_MAX_WAIT_MS,
  timeout: INTERACTIVE_TRANSACTION_TIMEOUT_MS,
} as const;
