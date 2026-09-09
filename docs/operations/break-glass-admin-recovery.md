# Break-Glass SUPER_ADMIN Recovery

Status: PROCEDURE DEFINED / PRODUCTION EXERCISE REQUIRED

This runbook exists for the exceptional case where Takineo has no usable
`SUPER_ADMIN` account. It deliberately does **not** add a standing application
endpoint, signup path, environment flag, or ordinary CLI option that bypasses
the normal administrative authority chain.

## Trigger

Use this procedure only when all normal recovery paths are unavailable, for
example when every legitimate `SUPER_ADMIN` is disabled, suspended, revoked,
or otherwise unable to authenticate. A forgotten password alone is not a
break-glass event if the normal identity-recovery path remains available.

## Required controls

Before changing production state:

1. Open an incident and assign an incident ID.
2. Require two authorized maintainers to approve the recovery.
3. Verify the intended recovery user's identity out of band.
4. Confirm there is no usable active `SUPER_ADMIN`.
5. Create or verify a current database restore point.
6. Use privileged database/provider access that is not available to the normal
   application runtime.
7. Record who approved, who executed, the target user, the incident ID, and UTC
   timestamps in the restricted operations incident record.

## Recovery action

The recovery must affect **one existing verified user only**. Do not create a
shadow user and do not modify the user's product role to manufacture admin
authority.

Inside one reviewed database transaction, the privileged operator may restore
that user's account to `ACTIVE` and restore/create exactly one non-revoked
`AdminAccess` row with `SUPER_ADMIN`. The exact provider-console statement is
kept in the restricted operations vault and must be tested against staging
before production use; it is intentionally not stored as an application
bypass in this repository.

Do not disable audit immutability triggers and do not fabricate an ordinary
`AdminAuditEvent` with a false actor merely to make the emergency mutation look
like a normal in-product action. The incident record is the authoritative
break-glass evidence for the emergency database mutation.

## Immediate verification

After recovery:

1. Authenticate as the recovered administrator through the normal Better Auth
   flow.
2. Verify current-admin capabilities through the normal server boundary.
3. Inspect all `AdminAccess` rows and account states.
4. Use the normal `ops:admin` workflow for any follow-up grant/revoke/status
   changes so those subsequent mutations produce ordinary immutable audit
   events.
5. Revoke stale sessions and rotate credentials/secrets if compromise is
   suspected.
6. Remove any temporary provider/database privilege granted to execute the
   incident.

## Post-incident requirements

Before closing the incident:

- reconcile the incident timeline with database/provider logs
- confirm at least two usable `SUPER_ADMIN` operators if the production
  governance model requires redundancy
- confirm no unintended admin access remains
- verify CI and the administrative security test matrix are still green
- document root cause and preventive actions

## Exercise requirement

This runbook is not considered operationally proven until a staging exercise
demonstrates the full sequence, including restore-point verification, one-user
recovery, normal-login validation, follow-up audited mutations, and privilege
cleanup. Production readiness evidence must reference that exercise.
