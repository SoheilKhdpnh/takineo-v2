import "server-only";

import { z } from "zod";

export class MuxConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MuxConfigurationError";
  }
}

const muxApiEnvironmentSchema = z.object({
  MUX_TOKEN_ID: z.string().trim().min(1),
  MUX_TOKEN_SECRET: z.string().trim().min(1),
});

const muxWebhookSecretSchema = z
  .string()
  .trim()
  .min(1);

export function getMuxApiConfiguration() {
  const result = muxApiEnvironmentSchema.safeParse({
    MUX_TOKEN_ID: process.env.MUX_TOKEN_ID,
    MUX_TOKEN_SECRET:
      process.env.MUX_TOKEN_SECRET,
  });

  if (!result.success) {
    throw new MuxConfigurationError(
      "Mux API credentials are not configured.",
    );
  }

  return {
    tokenId: result.data.MUX_TOKEN_ID,
    tokenSecret:
      result.data.MUX_TOKEN_SECRET,
  };
}

export function getMuxWebhookSecret(): string {
  const result = muxWebhookSecretSchema.safeParse(
    process.env.MUX_WEBHOOK_SECRET,
  );

  if (!result.success) {
    throw new MuxConfigurationError(
      "The Mux webhook secret is not configured.",
    );
  }

  return result.data;
}