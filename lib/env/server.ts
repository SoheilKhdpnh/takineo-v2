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
  DATABASE_URL: postgresUrlSchema,

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

// Netlify injects the site's canonical URL as `URL` (and
// `DEPLOY_PRIME_URL` for deploy previews/branch deploys), so
// BETTER_AUTH_URL only needs to be set explicitly for local dev
// or to override the auto-detected domain.
const resolvedBetterAuthUrl =
  process.env.BETTER_AUTH_URL ??
  process.env.URL ??
  process.env.DEPLOY_PRIME_URL;

const parsedEnvironment =
  serverEnvironmentSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_URL: resolvedBetterAuthUrl,
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET,
  });

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