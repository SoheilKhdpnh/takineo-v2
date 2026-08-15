# Administrative operator workflows

Status: Wave 1 operational contract

These workflows exist for privileged administrative changes that deliberately do
not belong in the browser product.

The supported operator commands are:

- bootstrap the first `SUPER_ADMIN`
- grant, change, or revoke administrative access
- change a user account between `ACTIVE`, `SUSPENDED`, and `DISABLED`

The CLI is an operator adapter over existing server-side services. It is not a
second authorization implementation.

## 1. Security boundary

There is no public admin signup, admin onboarding choice, or browser endpoint for
these workflows.

Run commands only from a trusted operator environment with the intended Takineo
server environment variables loaded.

The CLI:

- is dry-run by default
- requires `--apply` for every mutation
- requires an exact command-specific confirmation token with `--apply`
- resolves existing users by exactly one email or user ID
- rejects unknown options
- requires a reason for admin-access and account-status changes
- never asks for or prints passwords, Better Auth secrets, database passwords,
  Mux credentials, or session cookies

The underlying service layer independently enforces authorization and
transactional state invariants.

## 2. Command

Use:

```text
npm run ops:admin -- <command> [options]
```

Show help:

```text
npm run ops:admin -- --help
```

All examples below are dry-run examples unless `--apply` is explicitly shown.

## 3. Identify users safely

Every target accepts exactly one of:

```text
--target-email <email>
--target-user-id <id>
```

Every non-bootstrap actor accepts exactly one of:

```text
--actor-email <email>
--actor-user-id <id>
```

Do not provide both forms for the same actor or target.

Prefer email for human-operated workflows when the address is independently
verified. Prefer immutable user ID when acting from an incident ticket or an
existing trusted database/admin record.

Always inspect the dry-run output before applying.

## 4. Bootstrap the initial SUPER_ADMIN

Bootstrap is a special one-time boundary. It links an existing, active Takineo
user to the first administrative record.

Dry run:

```text
npm run ops:admin -- bootstrap-super-admin \
  --target-email first-admin@example.com
```

Apply only after verifying the displayed user:

```text
npm run ops:admin -- bootstrap-super-admin \
  --target-email first-admin@example.com \
  --apply \
  --confirm BOOTSTRAP_INITIAL_SUPER_ADMIN
```

The service refuses bootstrap when:

- the target does not exist
- the target account is not `ACTIVE`
- any non-revoked administrative access already exists
- the exact bootstrap confirmation is absent

On success it writes one `ADMIN_BOOTSTRAPPED` audit event atomically with the
new `SUPER_ADMIN` access record.

Do not use bootstrap for later administrators.

## 5. Grant or change administrative access

Only an active `SUPER_ADMIN` may perform this workflow.

Dry run:

```text
npm run ops:admin -- set-admin-access \
  --actor-email root@example.com \
  --target-email reviewer@example.com \
  --permission REVIEWER \
  --reason "Review operations coverage"
```

Allowed permission values:

- `REVIEWER`
- `SUPER_ADMIN`
- `NONE` — revoke administrative access

Apply:

```text
npm run ops:admin -- set-admin-access \
  --actor-email root@example.com \
  --target-email reviewer@example.com \
  --permission REVIEWER \
  --reason "Review operations coverage" \
  --apply \
  --confirm CHANGE_ADMIN_ACCESS
```

The service:

- requires the explicit `MANAGE_ADMIN_ACCESS` capability
- refuses to grant access to an inactive account
- refuses a no-op permission change
- prevents removal/demotion of the last active `SUPER_ADMIN`
- writes `ADMIN_ACCESS_GRANTED`, `ADMIN_PERMISSION_CHANGED`, or
  `ADMIN_ACCESS_REVOKED`
- records the operator reason and previous/new permission in the immutable audit
  event

## 6. Change account status

Only an active `SUPER_ADMIN` may perform account-level moderation.

Dry run:

```text
npm run ops:admin -- set-account-status \
  --actor-email root@example.com \
  --target-email user@example.com \
  --status SUSPENDED \
  --reason "Manual abuse investigation"
```

Allowed states:

- `ACTIVE`
- `SUSPENDED`
- `DISABLED`

Apply:

```text
npm run ops:admin -- set-account-status \
  --actor-email root@example.com \
  --target-email user@example.com \
  --status SUSPENDED \
  --reason "Manual abuse investigation" \
  --apply \
  --confirm CHANGE_ACCOUNT_STATUS
```

The service:

- requires the explicit `MODERATE_ACCOUNT` capability
- refuses no-op state changes
- prevents suspension/disablement of the last active `SUPER_ADMIN`
- writes `ACCOUNT_STATUS_CHANGED` with the reason and previous/new status
- queues public Mux playback revocation or restoration when the target is an
  approved teacher whose eligibility changes

Account moderation and teacher-application suspension remain separate state
machines.

## 7. Reasons

Operator reasons are internal administrative/audit content.

Requirements:

- 3–2000 characters
- factual and concise
- no passwords, API keys, auth cookies, private keys, or unnecessary sensitive
  personal data

The product-facing teacher moderation policy does not expose these exact reasons
to teachers merely because they are stored in the audit trail.

## 8. Dry-run and apply procedure

For every operation:

1. Confirm the intended deployment/database environment before running the CLI.
2. Run the command without `--apply`.
3. Verify actor identity, target identity, current account state, current admin
   permission, and requested state in the JSON preview.
4. Copy the same command and add `--apply` plus the exact confirmation token.
5. Record the incident/change ticket reference in the reason where appropriate.
6. Verify the resulting state using a second dry run or the appropriate
   server-side/admin read path.
7. Preserve terminal output only in approved operational logs; it contains user
   IDs and email addresses.

## 9. Failure behavior

Common safe failures include:

- target user not found
- actor is not an active `SUPER_ADMIN`
- target account is inactive when granting admin access
- requested state already matches current state
- attempting to remove/demote/suspend/disable the last active `SUPER_ADMIN`
- invalid confirmation token
- malformed permission/status/reason

Do not bypass these failures with direct SQL.

If the desired operation appears blocked by an invariant, investigate the
current state first. Do not delete or mutate immutable admin audit history.

## 10. Recovery and rollback

There is no generic "undo" command because each reversal is itself a privileged,
audited state transition.

Use a new explicit operator action:

- mistaken admin grant → `set-admin-access --permission NONE`
- mistaken revocation → grant the intended permission again
- mistaken permission change → set the previous permission again
- mistaken account suspension/disablement → `set-account-status --status ACTIVE`

Use a new reason describing the correction. Never rewrite the original audit
event.

The initial bootstrap is not reversed by deleting its audit record. If bootstrap
was performed for the wrong user, first establish a second verified
`SUPER_ADMIN`, then revoke the mistaken access through the ordinary audited
workflow.

## 11. Production evidence

Before Wave 1 production closure, retain evidence that:

- the initial bootstrap procedure was dry-run and applied successfully
- at least two trusted active `SUPER_ADMIN` accounts exist before routine
  operations begin
- grant/revoke and account-status workflows were exercised in a non-production
  environment
- the immutable audit events contain actor, target, action, reason where
  required, and previous/new state metadata
- the last-active-SUPER_ADMIN safety invariant is tested
- operator access to production environment variables and database credentials
  is restricted and reviewed

## 12. Prohibited shortcuts

Do not:

- add a public "become admin" endpoint
- put these controls into onboarding
- expose database credentials to a browser
- edit `admin_access` or `user.accountStatus` with ad-hoc production SQL during
  routine operations
- delete audit events to hide or "undo" a change
- share confirmation tokens as if they were authentication secrets; they are
  deliberate-action guards, while real authorization remains server-side
