import "server-only";

import { z } from "zod";

const postgresUrlSchema = z
  .string()
  .min(1, "DATABASE_URL is required")
  .refine(
    (value) =>
      value.startsWith("postgresql://") ||
      value.startsWith("postgres://"),
    {
      message: "DATABASE_URL must be a PostgreSQL URL",
    },
  );

const serverEnvironmentSchema = z.object({
<<<<<<< HEAD
  DATABASE_URL: postgresUrlSchema,
=======
  DIRECT_URL: postgresUrlSchema,
>>>>>>> origin/main

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

<<<<<<< HEAD
const parsedEnvironment =
  serverEnvironmentSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET,
  });
=======
const parsedEnvironment = serverEnvironmentSchema.safeParse({
  DIRECT_URL: process.env.DIRECT_URL,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
});
>>>>>>> origin/main

if (!parsedEnvironment.success) {
  console.error(
    "Invalid server environment variables:",
    parsedEnvironment.error.flatten().fieldErrors,
  );

  throw new Error(
    "Invalid server environment configuration",
  );
}

export const serverEnv = parsedEnvironment.data;