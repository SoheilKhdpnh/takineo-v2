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
  DATABASE_URL: postgresUrlSchema,
});

const parsedEnvironment = serverEnvironmentSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
});

if (!parsedEnvironment.success) {
  console.error(
    "Invalid server environment variables:",
    parsedEnvironment.error.flatten().fieldErrors,
  );

  throw new Error("Invalid server environment configuration");
}

export const serverEnv = parsedEnvironment.data;