# Testing Strategy

## Goal

Tests protect product behavior, authorization, data integrity, localization,
and important integration boundaries.

The test suite should emphasize state transitions and adversarial behavior, not
only successful rendering.

## Wave 1 tooling contract

Wave 1 will establish:

- Vitest for unit, domain, and appropriate service-level tests
- React Testing Library for applicable React component tests
- Playwright for browser end-to-end tests

These tools are specified but are not installed by the documentation phase.

## Database safety

Database integration tests must use an explicitly configured:

```text
TEST_DATABASE_URL
```

Test infrastructure must fail closed if a safe test database is not explicitly
configured.

It must never use either of these as test fallbacks:

- `DATABASE_URL`
- `DIRECT_URL`

CI should eventually run database integration tests against an isolated,
disposable PostgreSQL test database. Test setup must verify the intended
environment before applying schema changes, seeding, truncating, or cleaning
data.

## Required test layers

### Unit and domain tests

Cover pure validation, eligibility predicates, allowed transitions, and stable
domain errors without requiring network or database access.

### Service and database integration tests

Cover ownership, authorization-sensitive workflows, transactions,
compare-and-set behavior, audit records, provider orchestration boundaries, and
data integrity using only the isolated test database.

### Route Handler tests

Cover authentication, authorization, origin protection, input validation,
stable error mapping, and avoidance of internal-detail leakage.

### Component tests

Use React Testing Library where interaction, accessibility, error state, or
conditional presentation has meaningful behavior. UI tests do not replace
server-side authorization tests.

### End-to-end tests

Use Playwright for critical localized user journeys, including RTL/LTR behavior,
loading/error states, and authorization boundaries visible through browser
flows.

## Authorization matrix

Wave 1 authorization tests must include at least:

- unauthenticated user
- student
- teacher `DRAFT`
- teacher `PENDING_REVIEW`
- teacher `APPROVED`
- teacher `REJECTED`
- teacher `SUSPENDED`
- `REVIEWER` administrator
- `SUPER_ADMIN`

Tests must verify both allowed operations and denied privilege-escalation or
cross-user/object-substitution attempts.

## Critical state and integration coverage

As relevant to the implemented feature, test:

- valid and invalid state transitions
- stale and duplicate mutations
- concurrent incompatible review decisions
- immutable audit behavior
- duplicate webhook delivery
- provider/internal identifier mismatch
- provider-sync fallback behavior
- Mux review-playback authorization and token exposure boundaries
- public playback creation and revocation lifecycle
- profile/video replacement races
- localization catalog parity
- Persian RTL and English LTR presentation
- unexpected provider and database failures

Later booking work must add transactional double-booking and concurrency tests.

## Test data and secrets

Use deterministic factories/builders for users, product roles, application
states, account states, admin permissions, profiles, videos, and review cycles.

Do not place real credentials, production identifiers, private media URLs,
database passwords, or provider signing keys in fixtures or snapshots.

## Required validation

Every code-changing task should run:

```bash
npm run check
```

Once test scripts are installed, tasks must also run the relevant unit,
integration, component, and/or end-to-end commands defined by their acceptance
criteria.

If a required check cannot run, document the exact command, reason, and
remaining risk. A missing safe `TEST_DATABASE_URL` is a reason to skip database
tests, never a reason to fall back to another database.

## Wave 1 admin backend testing handoff

Agent D must test the implemented DTOs and invariants in
`admin-backend-api.md`. The exact handoff is:

- `ACTIVE` Better Auth sliding refresh and `ACTIVE` sign out
- suspended/disabled `/get-session` denial without session refresh, while
  sign-out, session listing, and self-revocation remain available and every
  ordinary auth/product/admin operation is denied
- clean migration and full upgrade migration across every legacy application
  and video state/evidence combination
- editable malformed-video normalization and successful replacement afterward
- submission rejection for unsupported provider, blank/whitespace/noncanonical
  or incoherent IDs, and missing/out-of-range authoritative duration
- preservation of legacy application/video status, notes/reasons, submitted
  timestamps, and reviewed timestamps for rejected, pending, approved,
  suspended, and downgraded rows
- public-playback migration fixtures with unsupported provider, null/blank/
  whitespace asset, malformed playback ID, and incoherent identities
- complete rollback when any atomic migration guard raises
- stale worker death immediately after Mux public playback create
- stale worker death immediately after Mux public playback delete
- provider drift repair for due `SUCCEEDED` ENABLED and REVOKED intents
- duplicate public playback discovery and repair
- forced manual replay of terminal intents and bounded due batches
- scheduler/internal replay of terminal drift and internal-job authorization
- exact truthful `succeeded`, `requeued`, `skipped`, and `failed` counts
- expired lease recovery, intent-generation flips, worker concurrency, provider
  failures, and final database-write conflicts
- signed-token admin revocation/inactivity returning stable 403, plus concurrent
  reject/replace target races
- queue/detail admin authorization before validation or object lookup
- playback with an absent body succeeding and `{}`, whitespace, JSON `null`, or
  arbitrary fields returning `400 INVALID_REQUEST`
- differing Mux asset ID within the same video revision and delayed/duplicate
  webhook behavior
- Prisma `P2034` serialization conflict mapping to stable HTTP 409
- current-admin capabilities and applicant DTO provider-identifier privacy
- audit immutability for `UPDATE`, `DELETE`, and `TRUNCATE`
- the complete existing teacher application, profile, upload, sync, webhook,
  review, correction/resubmission, moderation, authorization, concurrency,
  response/nullability, stable-error, and `private, no-store` regression suite
