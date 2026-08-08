# Library-layer instructions

These instructions apply beneath `/lib`.

`lib/services` owns application workflows and database/provider orchestration.

`lib/domain` should prefer pure business rules without database/network access.

`lib/validations` owns Zod validation.

`lib/errors` owns stable domain-specific errors.

Keep server-only provider/database modules marked appropriately.

Never expose secrets through client-importable modules.

Authorization-sensitive state transitions belong in server-side services.

Avoid duplicating helpers that already exist elsewhere in `/lib`.