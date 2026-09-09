# Prisma and migration instructions

These instructions apply beneath `/prisma`.

Never modify an already-applied migration merely to make later code cleaner.

Create a new migration for new schema changes.

Review migration SQL before applying it.

Preserve existing data deliberately.

Never run destructive production commands.

Do not use `db push` as the normal production deployment strategy.

After schema changes:

- prisma format
- prisma validate
- create/review migration
- apply to intended development database
- regenerate client
- run project checks

Never commit database credentials.