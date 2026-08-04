# Authentication

Takineo uses Better Auth with Prisma and PostgreSQL.

<<<<<<< HEAD
The running Next.js application connects through Prisma's Neon
serverless adapter using the pooled `DATABASE_URL`.

Prisma CLI and migrations use the direct `DIRECT_URL` configured
in `prisma.config.ts`.

## Connections
=======
## Supported methods
>>>>>>> origin/main

The initial authentication foundation supports:

- Email and password registration
- Email and password login
- Persistent database sessions
- Sign out
- Server-side session validation

## Core database models

Better Auth owns the following models:

- `User`
- `Account`
- `Session`
- `Verification`

Application-specific role and profile data must be added through
separate models and relations. Authentication tables should not be
used as a substitute for teacher or student domain models.

## Environment variables

Required local variables:

- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_APP_URL`

Never commit real secrets or database connection strings.

## Routes

- `/sign-up`
- `/sign-in`
- `/dashboard`
- `/api/auth/[...all]`

## Password policy

Passwords currently require between 8 and 128 characters.

Password hashes are stored by Better Auth in credential `Account`
records. Raw passwords must never be logged or persisted by
application code.

## Authorization

Authentication proves the identity of a user.

Student and teacher permissions will be implemented separately during
the onboarding and authorization milestone.