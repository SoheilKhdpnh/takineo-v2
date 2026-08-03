import "server-only";

import { z } from "zod";

const postgresUrlSchema = z
  .string()
  .min(1, "Database URL is required")
  .refine(
    (value) =>
      value.startsWith("postgresql://") ||
      value.startsWith("postgres://"),
    {
      message: "Expected a PostgreSQL connection URL",
    },
  );

const serverEnvironmentSchema = z.object({
  DIRECT_URL: postgresUrlSchema,

  BETTER_AUTH_URL: z
    .string()
    .url("BETTER_AUTH_URL must be a valid URL"),

  BETTER_AUTH_SECRET: z
    .string()
    .min(
      32,
      "BETTER_AUTH_SECRET must contain at least 32 characters",
    ),
});

const parsedEnvironment = serverEnvironmentSchema.safeParse({
  DIRECT_URL: process.env.DIRECT_URL,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
});

if (!parsedEnvironment.success) {
  console.error(
    "Invalid server environment variables:",
    parsedEnvironment.error.flatten().fieldErrors,
  );

  throw new Error("Invalid server environment configuration");
}

export const serverEnv = parsedEnvironment.data;