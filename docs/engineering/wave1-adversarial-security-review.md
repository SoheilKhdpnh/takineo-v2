# Wave 1 Adversarial Security Review

Date: 2026-08-15
Scope baseline: `cc4a2c3` (`codex/wave1-admin-review-ui` after Milestone 16)

## Purpose

This review is an independent adversarial pass over the Wave 1 administrative
surface. It does not treat UI affordances as authorization boundaries. The
review assumes a malicious authenticated user, a malicious or stale reviewer,
an object-substitution attempt, a cross-origin browser request, scheduler secret
guessing, concurrent review/moderation actions, provider drift, and accidental
test/production database aliasing.

The review covers:

- persisted `AdminAccess` authorization and account-state invalidation
- queue/detail/playback/approve/reject/moderation routes and service boundaries
- stale review guards and serializable state transitions
- private Mux review playback and public-playback reconciliation
- operator-only admin/account commands and immutable audit writes
- internal reconciliation-job authentication and bounded input
- integration/E2E database isolation and destructive reset boundaries
- CI database and authentication configuration
- applicant-visible moderation/rejection privacy

## Result

No unresolved Critical or High privilege-escalation finding was identified in
the reviewed Wave 1 admin/review implementation after the fixes in this
milestone.

The existing architecture correctly keeps product role separate from admin
access, denies inactive/revoked administrators, re-authorizes private playback
before returning a token, applies compare-and-set review guards, uses
serializable administrative transactions, protects browser mutations with an
exact trusted origin, fences Mux reconciliation work, and keeps privileged
admin/account changes out of normal browser routes.

## Findings fixed in this milestone

### ASR-01 — integration database guard compared URL strings, not database identity

Severity before fix: **High test-safety risk**.

The integration guard previously required `TEST_DATABASE_URL` to differ from
`DATABASE_URL` / `DIRECT_URL` as a normalized full URL. Two URLs can use
different passwords, protocols or query parameters while still targeting the
same PostgreSQL database identity. That made the fail-closed promise weaker than
the live integration contract.

Resolution:

- `TEST_DATABASE_URL` must now identify exactly
  `takineo_test@127.0.0.1:5432/takineo_test`.
- the dedicated password must be present.
- protected application/direct URLs are compared by physical target (host, port
  and database name) rather than credential-bearing URL equality.
- unit regression cases cover alternate credentials and URL spellings.

The existing live PostgreSQL identity assertion remains defense in depth.

### ASR-02 — E2E separation could miss same-database aliases

Severity before fix: **Medium test-isolation risk**.

The E2E guard already required the canonical local `takineo_e2e` identity, so it
could not silently become a production database. However, its comparison with
`TEST_DATABASE_URL` and the pre-remap app URLs used full URL equality. A second
credential or query-string spelling of the same database could bypass that
separation check.

Resolution:

- protected/base URLs are now compared by PostgreSQL database identity.
- controlled Playwright runtime aliasing still requires `DATABASE_URL` and
  `DIRECT_URL` to be the exact remapped E2E URL.
- regression cases cover different credentials and query strings pointing at
  the same identity.

### ASR-03 — Browser E2E CI depended on local `.env` auth configuration

Severity before fix: **Medium CI enforcement defect**.

The Browser E2E job had isolated database variables but did not define its own
`NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`, or `BETTER_AUTH_SECRET`. Local runs
worked because the developer `.env` supplied those values; a clean GitHub
runner has no such file.

Resolution:

- Browser E2E now declares disposable CI-only application/auth values for
  `127.0.0.1:3100`.
- no production Better Auth or database secret is required by CI.

### ASR-04 — unexpected admin errors could log raw exception details

Severity before fix: **Medium sensitive-logging risk**.

The admin HTTP error mapper correctly returned a generic `500` to the browser,
but it logged the complete unexpected exception object. Provider/database error
messages can contain connection or operational details that do not belong in
production logs.

Resolution:

- unexpected admin errors now log only a safe error class name and an optional
  bounded machine code.
- raw exception messages/stacks are not emitted by this mapper.
- regression coverage injects credential-like text plus newline-bearing fake error names/codes and proves none
  are reflected into the log payload.

### ASR-05 — adversarial origin and internal-job request cases were implicit

Severity before fix: **Low coverage gap**.

Resolution:

- exact trusted-origin behavior now has independent adversarial unit coverage
  for scheme, port, suffix-domain, foreign-origin and missing-origin cases.
- the internal Mux job now has explicit tests proving missing authentication is
  rejected before malformed-body parsing and that extra forged fields are
  rejected by the strict schema.

## Reviewed boundaries with no new defect found

### Administrative privilege escalation

`AdminAccess` remains a persisted, server-side boundary independent of the
student/teacher product role. `REVIEWER` receives review capability only;
teacher moderation, account moderation, admin-access management and session
management remain `SUPER_ADMIN` capabilities. Suspended, disabled and revoked
administrators are denied.

### Object substitution and stale review actions

Route identifiers and stale guards are validated server-side. Review decisions
must match review cycle, submitted profile revision, submitted video ID and
submitted video revision. The service additionally binds submitted upload/asset
state to the current Mux-backed video before mutation. Concurrent/incompatible
review and moderation operations are guarded by compare-and-set writes and
serializable transactions.

### Private Mux review playback

Playback is available only for a current pending review. The service
re-authorizes the administrator after creating/signing provider state and
rechecks that the exact review snapshot is still reviewable before returning
the short-lived grant. Signing material remains server-only and the browser
player uses no-referrer/cookie-disabled embedding.

A grant already returned to an administrator cannot be remotely revoked from
Mux at the exact instant that administrator access is later removed; exposure
is bounded by the short review-token TTL. This is an accepted residual property
of the provider token model, not a Wave 1 authorization bypass.

### Moderation and operator workflows

Browser teacher suspension/reinstatement requires `MODERATE_TEACHER` and trusted
origin. Account-status and admin-access changes are not exposed as normal
browser routes. Operator CLI mutations are dry-run by default and require both
`--apply` and the exact confirmation token. Service authorization and the last
active `SUPER_ADMIN` invariant remain authoritative beneath the CLI.

### Audit integrity

Review, moderation, account and admin-access mutations write audit events inside
the same administrative transaction as their durable state change. Existing
acceptance coverage verifies rollback on audit failure and database-level audit
immutability.

### Internal Mux scheduler

The internal job uses a minimum-length server secret, timing-safe equality for
equal-length values, private/no-store responses, strict bounded input and stable
non-secret error codes. Scheduler logs contain aggregate health/result data and
do not log the internal secret or heartbeat URL.

## Residual pre-beta items — not silently closed by M17

These are already documented production-readiness requirements and remain open
for Milestone 18 or deployment readiness evidence:

1. **Rate limiting / abuse prevention:** still not implemented for the required
   public-beta surfaces, including high-impact admin operations where
   appropriate.
2. **Security headers / CSP:** production browser headers still require explicit
   review and provider-aware CSP configuration.
3. **Dependency/security audit:** run and review the production dependency audit
   at release-candidate time; do not treat a historical audit as permanent
   evidence.
4. **Remote CI enforcement:** the workflow exists, but required GitHub branch
   checks can only be proven after push and branch-protection configuration.
5. **Production scheduler/monitor evidence:** Netlify schedule, secret rotation
   and heartbeat behavior require deployed-runtime evidence.
6. **Break-glass admin recovery:** normal tooling deliberately prevents bypass of
   the active-admin authority chain. Production operations still need a
   documented, tightly controlled recovery procedure for loss of all usable
   `SUPER_ADMIN` accounts without turning bootstrap into a standing bypass.

None of these residual items should be interpreted as complete merely because
Wave 1 application tests pass.

## Acceptance evidence expected

Milestone 17 is accepted when the following pass after this patch:

- focused database-safety and adversarial security unit tests
- full unit suite
- full integration suite
- existing 5-case Playwright browser suite
- `npm run check`
- `git diff --check`

The successful M15 browser run and M16 workflow remain part of the evidence, but
M17 must not reduce any previously established gate.
