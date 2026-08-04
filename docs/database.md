# Database

Takineo uses PostgreSQL hosted by Neon and Prisma ORM for
type-safe database access and migration management.

The running Next.js application connects through Prisma's Neon
serverless adapter using the pooled `DATABASE_URL`.

Prisma CLI and migrations use the direct `DIRECT_URL` configured
in `prisma.config.ts`.

## Connections

The application uses two PostgreSQL connection strings.

### `DATABASE_URL`

A pooled Neon connection used by the running Next.js application.

The hostname normally contains `-pooler`.

### `DIRECT_URL`

A direct Neon connection used by Prisma CLI and database migrations.

The hostname does not contain `-pooler`.

## Local environment

Create `.env` from `.env.example` and provide real development
database connection strings.

Never commit `.env` or database credentials.

## Prisma commands

Format the schema:

```bash
npm run db:form