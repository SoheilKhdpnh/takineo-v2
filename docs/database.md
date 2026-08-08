# Database and Authentication

Takineo uses Better Auth with Prisma and PostgreSQL.

The running Next.js application connects through Prisma's Neon serverless
adapter using the pooled `DATABASE_URL`. Prisma CLI and migrations use the
direct `DIRECT_URL` configured in `prisma.config.ts`.

## Current authentication foundation

- email/password registration
- email/password login
- persistent database sessions
- sign out
- server-side session validation
- server-owned product role field

Better Auth owns the core identity/session models:

- `User`
- `Account`
- `Session`
- `Verification`

Application-specific role, profile, teacher application, video, future account
moderation, and administrative access data remain separate domain concerns.
Authentication tables are not a substitute for application authorization.

## Current application models

- `StudentProfile`
- `TeacherProfile`
- `TeacherIntroVideo`

The current schema also defines product-role, profile, timezone/language,
teacher-application, and teacher-video enums.

Wave 1 will design and migrate the server-controlled account moderation,
administrative permission, and immutable review/audit persistence required by
[admin-review-contract.md](engineering/admin-review-contract.md). This document
does not prescribe the final table shape.

## Environment variables

Application/runtime configuration requires:

- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `DATABASE_URL`

Prisma CLI/migrations require:

- `DIRECT_URL`

Client auth configuration may use intentionally public application-origin
configuration where required by the application, but database and auth secrets
must never use `NEXT_PUBLIC_*`.

Database integration tests must use only:

- `TEST_DATABASE_URL`

Test tooling must fail closed if `TEST_DATABASE_URL` is absent and must never
fall back to `DATABASE_URL` or `DIRECT_URL`.

Never commit real secrets or connection strings.

## Password policy

Passwords currently require between 8 and 128 characters. Better Auth stores
password hashes in credential `Account` records. Raw passwords must never be
logged or persisted by application code.

## Database change workflow

Every schema change requires:

1. Edit `prisma/schema.prisma`.
2. Format and validate the schema.
3. Create a new migration; do not rewrite already-applied migrations.
4. Review generated SQL and data-preservation effects.
5. Apply only to the intended environment.
6. Regenerate Prisma Client.
7. Run relevant tests and `npm run check`.

Production migration execution must eventually be a controlled deployment step
with one execution path per release, environment verification, migration
validation, and rollback/recovery procedures. A generic hosting build that runs
`prisma migrate deploy && npm run build` is not the final production strategy.

Never use `prisma db push` as the normal production schema deployment strategy
and never run destructive database commands against production.
